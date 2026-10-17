import { beforeEach, describe, expect, it } from "vitest";
import { exportCsv, exportJson, importJson } from "../src/data/backup";
import { Db } from "../src/data/db";
import { Repo } from "../src/data/repo";
import { migrate } from "../src/data/schema";
import { memoryDb } from "./nodeDb";

const MON = "2026-10-05";

let db: Db;
let repo: Repo;
let day: number;

beforeEach(async () => {
  db = memoryDb();
  await migrate(db);
  repo = new Repo(db);
  const programId = await repo.createProgram({ name: "Force", cycle: "week", startDate: MON });
  day = await repo.addSession(programId, { name: 'Day, "A"', slot: 0 });
  await repo.addExercise(day, { name: "Squat", sets: 2, goal: "strength", equipment: "barbell" });
  const logId = await repo.startSession(day, MON);
  for (const s of (await repo.getSessionLog(logId)).exercises[0].sets) await repo.logSet(s.id, { weight: 100, reps: 5, rpe: 8 });
  await repo.validateSession(logId, MON);
  await repo.addObjective({ exerciseId: 1, reps: 5, weight: 120, byDate: "2027-03-01" });
  await repo.markRest("2026-10-06");
});

async function fresh() {
  const other = memoryDb();
  await migrate(other);
  return { db: other, repo: new Repo(other) };
}

describe("JSON export and import", () => {
  it("restores everything into a fresh database, frozen history included", async () => {
    const json = await exportJson(db);
    const target = await fresh();
    await importJson(target.db, json);

    expect(JSON.parse(await exportJson(target.db)).tables).toEqual(JSON.parse(json).tables);
    const [log] = await target.db.all<{ id: number; status: string; validated_at: string | null }>("SELECT id, status, validated_at FROM session_log");
    expect(log.status).toBe("validated");
    expect(log.validated_at).not.toBeNull();
    // Validated history stays frozen after the import.
    const setId = (await target.repo.getSessionLog(log.id)).exercises[0].sets[0].id;
    await expect(target.repo.logSet(setId, { weight: 999, reps: 5, rpe: 8 })).rejects.toThrow();
    expect((await target.repo.getProgress())[0].records).toEqual([{ reps: 5, weight: 100, date: MON }]);
    expect(await target.repo.getObjectives()).toHaveLength(1);
  });

  it("replaces what was in the database", async () => {
    const json = await exportJson(db);
    const target = await fresh();
    await target.repo.createProgram({ name: "Other", cycle: "month", startDate: "2026-01-01" });
    await importJson(target.db, json);
    expect((await target.repo.getActiveProgram())!.name).toBe("Force");
    expect(await target.db.all("SELECT * FROM program")).toHaveLength(1);
  });

  it("rejects an invalid file and leaves the data untouched", async () => {
    await expect(importJson(db, "not json")).rejects.toThrow();
    await expect(importJson(db, JSON.stringify({ app: "other" }))).rejects.toThrow();
    const newer = JSON.parse(await exportJson(db));
    newer.schemaVersion += 1;
    await expect(importJson(db, JSON.stringify(newer))).rejects.toThrow(/version/i);
    const broken = JSON.parse(await exportJson(db));
    broken.tables.set_log[0].exercise_id = 999;
    await expect(importJson(db, JSON.stringify(broken))).rejects.toThrow();
    expect(await db.all("SELECT * FROM set_log")).toHaveLength(2);
    expect(await db.all("SELECT * FROM program")).toHaveLength(1);
  });
});

describe("CSV export", () => {
  it("has one row per Set, with quoted fields", async () => {
    const lines = (await exportCsv(db)).trim().split("\n");
    expect(lines[0]).toBe("date,session,status,exercise,goal,set,planned_weight,planned_reps,weight,reps,rpe,not_completed");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(`2026-10-05,"Day, ""A""",validated,Squat,strength,1,,,100,5,8,0`);
  });
});
