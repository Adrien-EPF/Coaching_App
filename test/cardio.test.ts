import { beforeEach, describe, expect, it } from "vitest";
import { exportCsv, exportJson, importJson } from "../src/data/backup";
import { Db } from "../src/data/db";
import { Repo } from "../src/data/repo";
import { migrate } from "../src/data/schema";
import { orderSports } from "../src/domain/sports";
import { memoryDb } from "./nodeDb";

const MON = "2026-10-05";
const TUE = "2026-10-06";
const WED = "2026-10-07";

let db: Db;
let repo: Repo;
let programId: number;

beforeEach(async () => {
  db = memoryDb();
  await migrate(db);
  repo = new Repo(db);
  programId = await repo.createProgram({ name: "Mixte", cycle: "week", startDate: MON });
});

async function logWholeSession(sessionId: number, date: string) {
  const logId = await repo.startSession(sessionId, date);
  for (const s of (await repo.getSessionLog(logId)).exercises.flatMap((e) => e.sets)) await repo.logSet(s.id, { weight: 100, reps: 5, rpe: 8 });
  return repo.validateSession(logId, date);
}

describe("Session Type migration", () => {
  it("turns every Session of a v1 database into a strength Session, history intact", async () => {
    const old = memoryDb();
    // A v1 database: only the first 6 migrations ran.
    await migrate(old, 6);
    await old.exec(`
      INSERT INTO exercise (name) VALUES ('Squat');
      INSERT INTO program (name, cycle, start_date, active) VALUES ('P', 'week', '${MON}', 1);
      INSERT INTO program_session (program_id, name, slot) VALUES (1, 'A', 0);
      INSERT INTO session_exercise (program_session_id, exercise_id, position, sets, goal) VALUES (1, 1, 1, 1, 'strength');
      INSERT INTO session_log (program_session_id, name, date, status) VALUES (1, 'A', '${MON}', 'validated');
      INSERT INTO set_log (session_log_id, exercise_id, position, goal, set_index, weight, reps, rpe) VALUES (1, 1, 1, 'strength', 0, 100, 5, 8);
    `);
    await migrate(old);
    expect(await old.all("SELECT type FROM program_session")).toEqual([{ type: "strength" }]);
    expect(await old.all("SELECT type FROM session_log")).toEqual([{ type: "strength" }]);
    expect(await new Repo(old).getProgress()).toHaveLength(1);
  });

  it("imports a backup made before types as strength Sessions", async () => {
    const a = await repo.addSession(programId, { name: "A", slot: 0 });
    await repo.addExercise(a, { name: "Squat", sets: 1, goal: "strength", equipment: "barbell" });
    await logWholeSession(a, MON);
    const old = JSON.parse(await exportJson(db));
    for (const t of ["program_session", "session_log"]) for (const r of old.tables[t]) delete r.type;
    delete old.tables.cardio_log;
    old.schemaVersion = 6;

    const target = memoryDb();
    await migrate(target);
    await importJson(target, JSON.stringify(old));
    expect(await target.all("SELECT type FROM program_session")).toEqual([{ type: "strength" }]);
    expect(await target.all("SELECT type FROM session_log")).toEqual([{ type: "strength" }]);
    expect(await new Repo(target).getProgress()).toHaveLength(1);
  });
});

describe("planned cardio Session", () => {
  it("a Program can mix strength and cardio, and a cardio Session has no Exercises", async () => {
    const lift = await repo.addSession(programId, { name: "Haut", slot: 0 });
    const tennis = await repo.addSession(programId, { type: "cardio", sport: "Tennis", slot: 1 });
    const detail = await repo.getProgramDetail(programId);
    expect(detail.sessions.map((s) => [s.id, s.type, s.sport, s.name])).toEqual([
      [lift, "strength", null, "Haut"],
      [tennis, "cardio", "Tennis", "Tennis"],
    ]);
    await expect(repo.addExercise(tennis, { name: "Squat", sets: 3, goal: "strength" })).rejects.toThrow();
  });

  it("a cardio Session needs neither name nor sport", async () => {
    const id = await repo.addSession(programId, { type: "cardio", slot: 3 });
    expect((await repo.getProgramDetail(programId)).sessions[0]).toMatchObject({ id, name: "Cardio", sport: null });
  });

  it("shows on the calendar with its type and sport, and a cardio not done is Missed", async () => {
    const tennis = await repo.addSession(programId, { type: "cardio", sport: "Tennis", slot: 1 });
    const [, tue] = await repo.getCalendar(MON, TUE, MON);
    expect(tue.items[0]).toMatchObject({ type: "planned", sessionId: tennis, sessionType: "cardio", sport: "Tennis", status: "planned" });
    expect((await repo.getCalendar(TUE, TUE, WED))[0].items[0]).toMatchObject({ status: "missed" });
    await repo.markMissed(tennis, TUE);
    expect((await repo.getCalendar(TUE, TUE, TUE))[0].items[0]).toMatchObject({ status: "missed" });
  });
});

describe("logging cardio", () => {
  it("validates in one go, appears on its date and counts as done", async () => {
    const tennis = await repo.addSession(programId, { type: "cardio", sport: "Tennis", slot: 1 });
    const logId = await repo.logCardio({ programSessionId: tennis, date: TUE, sport: "Tennis", durationMin: 90, rpe: 7, note: "Match" });
    expect(await repo.getCardio(logId)).toMatchObject({ sport: "Tennis", durationMin: 90, rpe: 7, note: "Match", distanceKm: null, avgHr: null });
    expect((await repo.getCalendar(TUE, TUE, WED))[0].items[0]).toMatchObject({ type: "planned", status: "done" });
    expect((await repo.getAdherence(WED)).months).toEqual([{ period: "2026-10", planned: 1, done: 1 }]);
  });

  it("an Unplanned cardio Session shows on the calendar", async () => {
    const logId = await repo.logCardio({ programSessionId: null, date: WED, sport: "Course", durationMin: 40, rpe: 6, distanceKm: 7.5, avgHr: 150 });
    expect((await repo.getCalendar(WED, WED, WED))[0].items).toEqual([{ type: "cardio", logId, sport: "Course", durationMin: 40, rpe: 6 }]);
  });

  it("logging the same planned occurrence again corrects it", async () => {
    const tennis = await repo.addSession(programId, { type: "cardio", sport: "Tennis", slot: 1 });
    const a = await repo.logCardio({ programSessionId: tennis, date: TUE, sport: "Tennis", durationMin: 60, rpe: 5 });
    const b = await repo.logCardio({ programSessionId: tennis, date: TUE, sport: "Tennis", durationMin: 75, rpe: 6 });
    expect(b).toBe(a);
    expect((await repo.getCardio(a)).durationMin).toBe(75);
  });

  it("checks the required fields", async () => {
    const base = { programSessionId: null, date: WED, sport: "Vélo", durationMin: 30, rpe: 5 };
    await expect(repo.logCardio({ ...base, sport: "  " })).rejects.toThrow();
    await expect(repo.logCardio({ ...base, durationMin: 0 })).rejects.toThrow();
    await expect(repo.logCardio({ ...base, rpe: 11 })).rejects.toThrow();
    await expect(repo.logCardio({ ...base, distanceKm: -1 })).rejects.toThrow();
    await expect(repo.logCardio({ ...base, avgHr: 0 })).rejects.toThrow();
  });

  it("strength logging refuses a cardio Session", async () => {
    const tennis = await repo.addSession(programId, { type: "cardio", slot: 1 });
    await expect(repo.startSession(tennis, TUE)).rejects.toThrow();
  });

  it("can be removed", async () => {
    const logId = await repo.logCardio({ programSessionId: null, date: WED, sport: "Vélo", durationMin: 30, rpe: 5 });
    await repo.removeCardio(logId);
    expect((await repo.getCalendar(WED, WED, WED))[0].items).toEqual([]);
  });

  it("is in the JSON and CSV backups", async () => {
    await repo.logCardio({ programSessionId: null, date: WED, sport: "Natation", durationMin: 45, rpe: 6, distanceKm: 1.5 });
    const target = memoryDb();
    await migrate(target);
    await importJson(target, await exportJson(db));
    expect(await target.all("SELECT sport, duration_min FROM cardio_log")).toEqual([{ sport: "Natation", duration_min: 45 }]);
    const lines = (await exportCsv(db)).trim().split("\n");
    expect(lines[0]).toContain("type,duration_min,distance_km,avg_hr");
    expect(lines[1]).toBe(`${WED},Natation,validated,Natation,,,,,,,6,0,cardio,45,1.5,`);
  });
});

describe("planning skips cardio", () => {
  it("Validating a strength Session plans the next strength Session, not the cardio between them", async () => {
    const mon = await repo.addSession(programId, { name: "Lundi", slot: 0 });
    await repo.addExercise(mon, { name: "Squat", sets: 1, goal: "strength", equipment: "barbell" });
    await repo.addSession(programId, { type: "cardio", sport: "Tennis", slot: 1 });
    const thu = await repo.addSession(programId, { name: "Jeudi", slot: 3 });
    await repo.addExercise(thu, { name: "Bench", sets: 1, goal: "strength", equipment: "barbell" });

    const { plan } = await logWholeSession(mon, MON);
    expect(plan?.sessionId).toBe(thu);
    expect(plan?.date).toBe("2026-10-08");
  });

  it("a cardio Session never gets a Session Plan", async () => {
    const tennis = await repo.addSession(programId, { type: "cardio", slot: 1 });
    expect(await repo.replanSession(tennis, TUE)).toBeNull();
  });
});

describe("sport suggestions", () => {
  it("puts the sports already used first, most used first, then the suggestions", () => {
    const list = orderSports(["Padel", "Tennis", "Padel", "course"]);
    expect(list.slice(0, 3)).toEqual(["Padel", "Tennis", "course"]);
    expect(list).toContain("Vélo");
    expect(list.filter((s) => s.toLowerCase() === "course")).toHaveLength(1);
  });

  it("reads the used sports from the logs", async () => {
    await repo.logCardio({ programSessionId: null, date: WED, sport: "Escalade", durationMin: 60, rpe: 6 });
    expect((await repo.listSports())[0]).toBe("Escalade");
  });
});
