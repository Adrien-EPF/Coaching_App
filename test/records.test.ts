import { beforeEach, describe, expect, it } from "vitest";
import { estimateOneRepMax, personalRecords } from "../src/domain/records";
import { Repo } from "../src/data/repo";
import { migrate } from "../src/data/schema";
import { memoryDb } from "./nodeDb";

describe("Estimated 1RM", () => {
  it("is Epley on the weight lifted", () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 1);
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });
});

describe("Personal Records", () => {
  it("keeps the heaviest weight at each rep count, with the first date it was lifted", () => {
    const prs = personalRecords([
      { weight: 100, reps: 5, date: "2026-10-01" },
      { weight: 105, reps: 5, date: "2026-10-08" },
      { weight: 105, reps: 5, date: "2026-10-15" },
      { weight: 120, reps: 3, date: "2026-10-08" },
    ]);
    expect(prs).toEqual([
      { reps: 3, weight: 120, date: "2026-10-08" },
      { reps: 5, weight: 105, date: "2026-10-08" },
    ]);
  });
});

const MON = "2026-10-05";
let repo: Repo;
let day: number;

beforeEach(async () => {
  const db = memoryDb();
  await migrate(db);
  repo = new Repo(db);
  const programId = await repo.createProgram({ name: "Force", cycle: "week", startDate: MON });
  day = await repo.addSession(programId, { name: "Day", slot: 0 });
  await repo.addExercise(day, { name: "Squat", sets: 2, goal: "strength", equipment: "barbell" });
  await repo.addExercise(day, { name: "Pull-up", sets: 1, goal: "endurance", equipment: "bodyweight" });
  await repo.addExercise(day, { name: "Weighted pull-up", sets: 1, goal: "strength", equipment: "weight_belt" });
});

async function validate(date: string, sets: Record<string, { weight: number | null; reps: number; rpe: number }[]>) {
  const logId = await repo.startSession(day, date);
  const log = await repo.getSessionLog(logId);
  for (const e of log.exercises) {
    const wanted = sets[e.name] ?? [];
    for (const [i, s] of e.sets.entries()) {
      if (wanted[i]) await repo.logSet(s.id, wanted[i]);
      else await repo.setSetNotCompleted(s.id, true);
    }
  }
  await repo.validateSession(logId, date);
  return logId;
}

describe("progress per Exercise", () => {
  it("is empty before any Validation, and ignores an open Session", async () => {
    expect(await repo.getProgress()).toEqual([]);
    const logId = await repo.startSession(day, MON);
    const squat = (await repo.getSessionLog(logId)).exercises[0];
    await repo.logSet(squat.sets[0].id, { weight: 100, reps: 5, rpe: 8 });
    expect(await repo.getProgress()).toEqual([]);
  });

  it("lists PRs and the Estimated 1RM once a Session is validated, and updates after the next Validation", async () => {
    await validate(MON, { Squat: [{ weight: 100, reps: 5, rpe: 8 }, { weight: 90, reps: 8, rpe: 8 }] });
    let squat = (await repo.getProgress()).find((p) => p.name === "Squat")!;
    expect(squat.records).toEqual([
      { reps: 5, weight: 100, date: MON },
      { reps: 8, weight: 90, date: MON },
    ]);
    expect(squat.estimatedOneRepMax).toBeCloseTo(116.67, 1);

    await validate("2026-10-12", { Squat: [{ weight: 105, reps: 5, rpe: 8 }] });
    squat = (await repo.getProgress()).find((p) => p.name === "Squat")!;
    expect(squat.records[0]).toEqual({ reps: 5, weight: 105, date: "2026-10-12" });
    expect(squat.estimatedOneRepMax).toBeCloseTo(122.5, 1);
  });

  it("skips Not Completed Sets and Exercises with no load", async () => {
    await validate(MON, { Squat: [{ weight: 100, reps: 5, rpe: 8 }], "Pull-up": [{ weight: null, reps: 12, rpe: 9 }] });
    const names = (await repo.getProgress()).map((p) => p.name);
    expect(names).toEqual(["Squat"]);
  });

  it("uses the added load of a weighted bodyweight movement, never bodyweight", async () => {
    await validate(MON, { "Weighted pull-up": [{ weight: 10, reps: 5, rpe: 8 }] });
    const wp = (await repo.getProgress()).find((p) => p.name === "Weighted pull-up")!;
    expect(wp.records).toEqual([{ reps: 5, weight: 10, date: MON }]);
    expect(wp.estimatedOneRepMax).toBeCloseTo(11.67, 1);
  });
});
