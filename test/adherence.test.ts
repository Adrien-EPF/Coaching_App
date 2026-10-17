import { describe, expect, it } from "vitest";
import { Repo } from "../src/data/repo";
import { migrate } from "../src/data/schema";
import { adherence } from "../src/domain/adherence";
import { memoryDb } from "./nodeDb";

describe("adherence", () => {
  const days = [
    { date: "2025-12-29", status: "done" as const },
    { date: "2026-01-05", status: "missed" as const },
    { date: "2026-01-12", status: "done" as const },
    { date: "2026-01-19", status: "skipped" as const },
    { date: "2026-02-02", status: "moved" as const },
    { date: "2026-02-04", status: "done" as const },
    { date: "2026-02-09", status: "planned" as const },
  ];

  it("counts Sessions done versus planned per month, skipping moved origins and not-yet-due ones", () => {
    const { months } = adherence(days);
    expect(months).toEqual([
      { period: "2025-12", planned: 1, done: 1 },
      { period: "2026-01", planned: 3, done: 1 },
      { period: "2026-02", planned: 1, done: 1 },
    ]);
  });

  it("rolls the months up into years", () => {
    const { years } = adherence(days);
    expect(years).toEqual([
      { period: "2025", planned: 1, done: 1 },
      { period: "2026", planned: 4, done: 2 },
    ]);
  });
});

describe("Repo.getAdherence", () => {
  it("is computed from the calendar and Validations", async () => {
    const db = memoryDb();
    await migrate(db);
    const repo = new Repo(db);
    const programId = await repo.createProgram({ name: "P", cycle: "week", startDate: "2026-09-28" });
    const day = await repo.addSession(programId, { name: "Mon", slot: 0 });
    await repo.addExercise(day, { name: "Squat", sets: 1, goal: "strength", equipment: "barbell" });
    // Mondays: 09-28 done, 10-05 missed, 10-12 skipped, 10-19 is today (not yet due).
    const logId = await repo.startSession(day, "2026-09-28");
    await repo.logSet((await repo.getSessionLog(logId)).exercises[0].sets[0].id, { weight: 100, reps: 5, rpe: 8 });
    await repo.validateSession(logId, "2026-09-28");
    await repo.skipSession(day, "2026-10-12");

    const { months, years } = await repo.getAdherence("2026-10-19");
    expect(months).toEqual([
      { period: "2026-09", planned: 1, done: 1 },
      { period: "2026-10", planned: 2, done: 0 },
    ]);
    expect(years).toEqual([{ period: "2026", planned: 3, done: 1 }]);
  });
});
