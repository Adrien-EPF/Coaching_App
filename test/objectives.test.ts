import { beforeEach, describe, expect, it } from "vitest";
import { Repo } from "../src/data/repo";
import { migrate } from "../src/data/schema";
import { Generate } from "../src/planner/gemini";
import { memoryDb } from "./nodeDb";

const MON = "2026-10-05";

let repo: Repo;
let prompts: string[];
let day: number;
let squatId: number;

// Gemini asks for a squat way above the Guardrails whatever the Objective says.
const wild = JSON.stringify({ summary: "Plan", exercises: [{ exerciseId: 1, weight: 200, reps: 3, sets: 4, reason: "Objectif" }] });

beforeEach(async () => {
  prompts = [];
  const generate: Generate = async (p) => {
    prompts.push(p);
    return wild;
  };
  const db = memoryDb();
  await migrate(db);
  repo = new Repo(db, undefined, async () => generate);
  const programId = await repo.createProgram({ name: "Force", cycle: "week", startDate: MON });
  day = await repo.addSession(programId, { name: "Day", slot: 0 });
  await repo.addExercise(day, { name: "Squat", sets: 2, goal: "strength", equipment: "barbell" });
  squatId = 1;
});

async function validate(date: string, weight: number, reps: number) {
  const logId = await repo.startSession(day, date);
  for (const s of (await repo.getSessionLog(logId)).exercises[0].sets) await repo.logSet(s.id, { weight, reps, rpe: 8 });
  await repo.validateSession(logId, date);
}

describe("Objectives", () => {
  it("creates an Objective on an Exercise with a target and a date, and lists it", async () => {
    await repo.addObjective({ exerciseId: squatId, reps: 5, weight: 120, byDate: "2027-03-01" });
    const [o] = await repo.getObjectives();
    expect(o).toMatchObject({ exerciseId: squatId, name: "Squat", reps: 5, weight: 120, byDate: "2027-03-01", current: 0, pct: 0 });
  });

  it("shows progress against the current PR, counting heavier sets at more reps", async () => {
    await repo.addObjective({ exerciseId: squatId, reps: 5, weight: 120, byDate: "2027-03-01" });
    await validate(MON, 90, 5);
    expect((await repo.getObjectives())[0]).toMatchObject({ current: 90, pct: 75 });
    await validate("2026-10-12", 100, 8);
    expect((await repo.getObjectives())[0]).toMatchObject({ current: 100, pct: 83 });
    await validate("2026-10-19", 125, 5);
    expect((await repo.getObjectives())[0]).toMatchObject({ current: 125, pct: 100 });
  });

  it("ignores sets that are not validated", async () => {
    await repo.addObjective({ exerciseId: squatId, reps: 5, weight: 120, byDate: "2027-03-01" });
    const logId = await repo.startSession(day, MON);
    await repo.logSet((await repo.getSessionLog(logId)).exercises[0].sets[0].id, { weight: 110, reps: 5, rpe: 8 });
    expect((await repo.getObjectives())[0].current).toBe(0);
  });

  it("rejects an invalid Objective and can remove one", async () => {
    await expect(repo.addObjective({ exerciseId: squatId, reps: 0, weight: 120, byDate: "2027-03-01" })).rejects.toThrow();
    await expect(repo.addObjective({ exerciseId: squatId, reps: 5, weight: 0, byDate: "2027-03-01" })).rejects.toThrow();
    await expect(repo.addObjective({ exerciseId: squatId, reps: 5, weight: 120, byDate: "mars" })).rejects.toThrow();
    const id = await repo.addObjective({ exerciseId: squatId, reps: 5, weight: 120, byDate: "2027-03-01" });
    await repo.removeObjective(id);
    expect(await repo.getObjectives()).toEqual([]);
  });

  it("passes Objectives to Gemini but never lets them override the Guardrails", async () => {
    await repo.addObjective({ exerciseId: squatId, reps: 5, weight: 200, byDate: "2027-03-01" });
    await validate(MON, 100, 5);
    const plan = await repo.getPlan(day);
    expect(prompts[0]).toContain("Objective: Squat 5 reps at 200 kg by 2027-03-01");
    expect(prompts[0]).toContain("never override the Guardrails");
    // Gemini asked for 200 kg: the Guardrails clamp it.
    expect(plan!.exercises[0].weight).toBeLessThanOrEqual(110);
  });
});
