import { beforeEach, describe, expect, it } from "vitest";
import { Repo } from "../src/data/repo";
import { migrate } from "../src/data/schema";
import { weeklyActivity } from "../src/domain/progressSeries";
import { memoryDb } from "./nodeDb";

const MON = "2026-10-05";

let repo: Repo;
let day: number;
let squatId: number;

beforeEach(async () => {
  const db = memoryDb();
  await migrate(db);
  repo = new Repo(db);
  const programId = await repo.createProgram({ name: "Force", cycle: "week", startDate: MON });
  day = await repo.addSession(programId, { name: "Day", slot: 0 });
  await repo.addExercise(day, { name: "Squat", sets: 2, goal: "strength", equipment: "barbell" });
  squatId = 1;
});

async function validate(date: string, weight: number, reps: number) {
  const logId = await repo.startSession(day, date);
  for (const s of (await repo.getSessionLog(logId)).exercises.flatMap((e) => e.sets)) await repo.logSet(s.id, { weight, reps, rpe: 8 });
  await repo.validateSession(logId, date);
}

describe("exercise history", () => {
  it("returns the validated Sets of the Exercise with their Training Goal, and ignores open Sessions", async () => {
    await validate(MON, 100, 5);
    const open = await repo.startSession(day, "2026-10-12");
    await repo.logSet((await repo.getSessionLog(open)).exercises[0].sets[0].id, { weight: 110, reps: 5, rpe: 8 });
    const h = await repo.getExerciseHistory(squatId);
    expect(h.name).toBe("Squat");
    expect(h.sets).toEqual([
      { date: MON, weight: 100, reps: 5, goal: "strength" },
      { date: MON, weight: 100, reps: 5, goal: "strength" },
    ]);
  });

  it("turns an Objective into the 1RM it stands for", async () => {
    await repo.addObjective({ exerciseId: squatId, reps: 5, weight: 120, byDate: "2027-03-01" });
    const h = await repo.getExerciseHistory(squatId);
    expect(h.targets).toHaveLength(1);
    expect(h.targets[0].oneRepMax).toBeCloseTo(140);
  });
});

describe("activity", () => {
  it("gives the volume of strength Sessions and the duration of cardio ones, validated only", async () => {
    await validate(MON, 100, 5); // 2 sets x 5 x 100
    await repo.logCardio({ programSessionId: null, date: "2026-10-07", sport: "Course", durationMin: 40, rpe: 6 });
    const open = await repo.startSession(day, "2026-10-12");
    await repo.logSet((await repo.getSessionLog(open)).exercises[0].sets[0].id, { weight: 110, reps: 5, rpe: 8 });

    const sessions = await repo.getActivity();
    expect(sessions).toEqual([
      { date: MON, type: "strength", volume: 1000, durationMin: null },
      { date: "2026-10-07", type: "cardio", volume: 0, durationMin: 40 },
    ]);
    expect(weeklyActivity(sessions, "all", "2026-10-08")).toEqual([{ weekStart: MON, volume: 1000, strength: 1, cardio: 1, cardioMin: 40 }]);
  });
});
