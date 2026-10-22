import { beforeEach, describe, expect, it } from "vitest";
import { Repo, SessionLogDetail } from "../src/data/repo";
import { migrate } from "../src/data/schema";
import { memoryDb } from "./nodeDb";

// 2026-10-05 is a Monday. One weekly Session on Mondays, one on Thursdays.
const MON = "2026-10-05";
const NEXT_MON = "2026-10-12";
const TODAY = MON;

let repo: Repo;
let monSession: number;
let thuSession: number;

beforeEach(async () => {
  const db = memoryDb();
  await migrate(db);
  repo = new Repo(db);
  const programId = await repo.createProgram({ name: "Force", cycle: "week", startDate: MON });
  monSession = await repo.addSession(programId, { name: "Squat day", slot: 0 });
  thuSession = await repo.addSession(programId, { name: "Bench day", slot: 3 });
  await repo.addExercise(monSession, { name: "Squat", sets: 4, goal: "strength", equipment: "barbell" });
  await repo.addExercise(monSession, { name: "Curl", sets: 3, goal: "hypertrophy", equipment: "dumbbell" });
  await repo.addExercise(thuSession, { name: "Bench", sets: 4, goal: "strength", equipment: "barbell" });
});

const exerciseNamed = (log: SessionLogDetail, name: string) => log.exercises.find((e) => e.name === name)!;

/** Logs every Set of every Exercise with the same numbers. */
async function logEverything(logId: number, numbers: { weight: number; reps: number; rpe: number }) {
  const log = await repo.getSessionLog(logId);
  for (const e of log.exercises) for (const s of e.sets) await repo.logSet(s.id, numbers);
}

describe("logging a Session", () => {
  it("lists every prescribed Set, empty, in Exercise order", async () => {
    const logId = await repo.startSession(monSession, MON);
    const log = await repo.getSessionLog(logId);
    expect(log.name).toBe("Squat day");
    expect(log.exercises.map((e) => [e.name, e.sets.length])).toEqual([["Squat", 4], ["Curl", 3]]);
    expect(log.exercises[0].sets[0]).toMatchObject({ weight: null, reps: null, rpe: null, notCompleted: false });
    expect(log.status).toBe("open");
  });

  it("starting the same Session on the same day again returns the same log", async () => {
    expect(await repo.startSession(monSession, MON)).toBe(await repo.startSession(monSession, MON));
  });

  it("logs weight, reps and RPE for a Set", async () => {
    const logId = await repo.startSession(monSession, MON);
    const setId = exerciseNamed(await repo.getSessionLog(logId), "Squat").sets[0].id;
    await repo.logSet(setId, { weight: 100, reps: 5, rpe: 8.5 });
    expect(exerciseNamed(await repo.getSessionLog(logId), "Squat").sets[0]).toMatchObject({ weight: 100, reps: 5, rpe: 8.5, notCompleted: false });
  });

  it("rejects an RPE outside 1-10, a missing weight, and zero reps", async () => {
    const logId = await repo.startSession(monSession, MON);
    const setId = exerciseNamed(await repo.getSessionLog(logId), "Squat").sets[0].id;
    await expect(repo.logSet(setId, { weight: 100, reps: 5, rpe: 11 })).rejects.toThrow();
    await expect(repo.logSet(setId, { weight: 100, reps: 0, rpe: 8 })).rejects.toThrow();
    await expect(repo.logSet(setId, { weight: null, reps: 5, rpe: 8 })).rejects.toThrow();
  });

  it("a bodyweight Exercise needs no weight", async () => {
    const pullups = await repo.addExercise(monSession, { name: "Traction", sets: 2, goal: "endurance", equipment: "bodyweight" });
    expect(pullups).toBeGreaterThan(0);
    const logId = await repo.startSession(monSession, MON);
    const setId = exerciseNamed(await repo.getSessionLog(logId), "Traction").sets[0].id;
    await repo.logSet(setId, { weight: null, reps: 12, rpe: 9 });
    expect(exerciseNamed(await repo.getSessionLog(logId), "Traction").sets[0]).toMatchObject({ reps: 12, notCompleted: false });
  });

  it("adds a Set to an Exercise, planned like its last one, in an open or a validated Session", async () => {
    const logId = await repo.startSession(monSession, MON);
    const squatId = exerciseNamed(await repo.getSessionLog(logId), "Squat").exerciseId;
    await repo.addSet(logId, squatId);
    let squat = exerciseNamed(await repo.getSessionLog(logId), "Squat");
    expect(squat.sets.map((s) => s.index)).toEqual([0, 1, 2, 3, 4]);
    expect((await repo.getSessionLog(logId)).remaining).toBe(8);

    await logEverything(logId, { weight: 100, reps: 5, rpe: 8 });
    await repo.validateSession(logId, TODAY);
    await repo.addSet(logId, squatId);
    squat = exerciseNamed(await repo.getSessionLog(logId), "Squat");
    expect(squat.sets).toHaveLength(6);
    await repo.editValidatedSet(squat.sets[5].id, { weight: 100, reps: 4, rpe: 9 }, TODAY);
    expect(exerciseNamed(await repo.getSessionLog(logId), "Squat").sets[5].reps).toBe(4);
  });

  it("logging a Set that was Not Completed makes it logged again", async () => {
    const logId = await repo.startSession(monSession, MON);
    const setId = exerciseNamed(await repo.getSessionLog(logId), "Squat").sets[0].id;
    await repo.setSetNotCompleted(setId, true);
    await repo.logSet(setId, { weight: 100, reps: 5, rpe: 8 });
    expect(exerciseNamed(await repo.getSessionLog(logId), "Squat").sets[0].notCompleted).toBe(false);
  });
});

describe("Not Completed", () => {
  it("can be set on a Set, which forgets its numbers", async () => {
    const logId = await repo.startSession(monSession, MON);
    const setId = exerciseNamed(await repo.getSessionLog(logId), "Squat").sets[0].id;
    await repo.logSet(setId, { weight: 100, reps: 5, rpe: 8 });
    await repo.setSetNotCompleted(setId, true);
    expect(exerciseNamed(await repo.getSessionLog(logId), "Squat").sets[0]).toMatchObject({ notCompleted: true, weight: null, reps: null, rpe: null });
  });

  it("can be set on a whole Exercise, and undone", async () => {
    const logId = await repo.startSession(monSession, MON);
    const squat = exerciseNamed(await repo.getSessionLog(logId), "Squat");
    await repo.setExerciseNotCompleted(logId, squat.exerciseId, true);
    let after = exerciseNamed(await repo.getSessionLog(logId), "Squat");
    expect(after.notCompleted).toBe(true);
    expect(after.sets.every((s) => s.notCompleted)).toBe(true);
    await repo.setExerciseNotCompleted(logId, squat.exerciseId, false);
    after = exerciseNamed(await repo.getSessionLog(logId), "Squat");
    expect(after.notCompleted).toBe(false);
    expect(after.sets.every((s) => !s.notCompleted)).toBe(true);
  });
});

describe("Validation", () => {
  it("is blocked until every Set is logged or Not Completed", async () => {
    const logId = await repo.startSession(monSession, MON);
    expect((await repo.getSessionLog(logId)).remaining).toBe(7);
    await expect(repo.validateSession(logId, TODAY)).rejects.toThrow(/7/);

    const log = await repo.getSessionLog(logId);
    for (const s of exerciseNamed(log, "Squat").sets) await repo.logSet(s.id, { weight: 100, reps: 5, rpe: 8 });
    await expect(repo.validateSession(logId, TODAY)).rejects.toThrow(/3/);
    expect((await repo.getSessionLog(logId)).status).toBe("open");

    await repo.setExerciseNotCompleted(logId, exerciseNamed(log, "Curl").exerciseId, true);
    expect((await repo.getSessionLog(logId)).remaining).toBe(0);
    await repo.validateSession(logId, TODAY);
    expect((await repo.getSessionLog(logId)).status).toBe("validated");
  });

  it("freezes the Session: nothing can be edited afterwards", async () => {
    const logId = await repo.startSession(monSession, MON);
    await logEverything(logId, { weight: 100, reps: 5, rpe: 8 });
    await repo.validateSession(logId, TODAY);
    const log = await repo.getSessionLog(logId);
    const setId = log.exercises[0].sets[0].id;
    await expect(repo.logSet(setId, { weight: 120, reps: 5, rpe: 8 })).rejects.toThrow();
    await expect(repo.setSetNotCompleted(setId, true)).rejects.toThrow();
    await expect(repo.setExerciseNotCompleted(logId, log.exercises[0].exerciseId, true)).rejects.toThrow();
    await expect(repo.validateSession(logId, TODAY)).rejects.toThrow();
    expect((await repo.getSessionLog(logId)).exercises[0].sets[0].weight).toBe(100);
  });

  it("keeps the validated Session as it was when the Program changes later", async () => {
    const logId = await repo.startSession(monSession, MON);
    await logEverything(logId, { weight: 100, reps: 5, rpe: 8 });
    await repo.validateSession(logId, TODAY);
    await repo.removeSession(monSession);
    const log = await repo.getSessionLog(logId);
    expect(log.name).toBe("Squat day");
    expect(log.exercises.map((e) => e.name)).toEqual(["Squat", "Curl"]);
  });

  it("shows a validated Session as done on the calendar", async () => {
    const logId = await repo.startSession(monSession, MON);
    await logEverything(logId, { weight: 100, reps: 5, rpe: 8 });
    await repo.validateSession(logId, TODAY);
    const days = await repo.getCalendar(MON, MON, "2026-10-20");
    expect(days[0].items[0]).toMatchObject({ type: "planned", status: "done" });
  });
});

describe("last Session's numbers", () => {
  it("shows, per Set, what was done the last time the Exercise was validated", async () => {
    const first = await repo.startSession(monSession, MON);
    const squat = exerciseNamed(await repo.getSessionLog(first), "Squat");
    await repo.logSet(squat.sets[0].id, { weight: 100, reps: 5, rpe: 8 });
    await repo.logSet(squat.sets[1].id, { weight: 100, reps: 4, rpe: 9 });
    await repo.setSetNotCompleted(squat.sets[2].id, true);
    await repo.setSetNotCompleted(squat.sets[3].id, true);
    await repo.setExerciseNotCompleted(first, exerciseNamed(await repo.getSessionLog(first), "Curl").exerciseId, true);
    await repo.validateSession(first, TODAY);

    const second = await repo.getSessionLog(await repo.startSession(monSession, NEXT_MON));
    const sets = exerciseNamed(second, "Squat").sets;
    expect(sets[0].last).toEqual({ weight: 100, reps: 5, rpe: 8 });
    expect(sets[1].last).toEqual({ weight: 100, reps: 4, rpe: 9 });
    expect(sets[2].last).toBeNull(); // Not Completed last time
  });

  it("ignores an open Session and shows nothing for a new Exercise", async () => {
    const first = await repo.startSession(monSession, MON);
    await logEverything(first, { weight: 100, reps: 5, rpe: 8 }); // logged but not validated
    const second = await repo.getSessionLog(await repo.startSession(monSession, NEXT_MON));
    expect(exerciseNamed(second, "Squat").sets[0].last).toBeNull();
  });
});

describe("planning the next Session on Validation", () => {
  it("the plan targets the next planned Session, not the one just validated", async () => {
    const first = await repo.startSession(monSession, MON);
    await logEverything(first, { weight: 100, reps: 5, rpe: 8 });
    const result = await repo.validateSession(first, TODAY);
    expect(result.plan).toMatchObject({ sessionId: thuSession, date: "2026-10-08" });
  });

  it("weights in the plan respect available increments and the Guardrails", async () => {
    const first = await repo.startSession(monSession, MON);
    const log = await repo.getSessionLog(first);
    for (const s of exerciseNamed(log, "Squat").sets) await repo.logSet(s.id, { weight: 100, reps: 5, rpe: 8 });
    for (const s of exerciseNamed(log, "Curl").sets) await repo.logSet(s.id, { weight: 10, reps: 12, rpe: 8 });
    await repo.validateSession(first, TODAY);

    // Next Monday's Session is planned when Thursday's is validated, so plan it directly through the Thursday log.
    const thu = await repo.startSession(thuSession, "2026-10-08");
    await logEverything(thu, { weight: 80, reps: 5, rpe: 8 });
    const result = await repo.validateSession(thu, "2026-10-08");
    const plan = result.plan!;
    expect(plan.sessionId).toBe(monSession);
    const squat = plan.exercises.find((e) => e.name === "Squat")!;
    const curl = plan.exercises.find((e) => e.name === "Curl")!;
    expect(squat.weight).toBe(106); // 100 +5%, barbell steps of 2 over a 20 kg bar
    expect(curl.weight).toBe(12); // dumbbell: at least one 2 kg step
    expect(squat.reason).toMatch(/hausse/i);
    expect(plan.summary.length).toBeGreaterThan(0);

    // Starting that Session pre-fills the planned values on every Set.
    const next = await repo.getSessionLog(await repo.startSession(monSession, NEXT_MON));
    expect(exerciseNamed(next, "Squat").sets.every((s) => s.plannedWeight === 106 && s.plannedReps === 3)).toBe(true);
    expect(exerciseNamed(next, "Curl").sets[0]).toMatchObject({ plannedWeight: 12, plannedReps: 8 });
    expect(exerciseNamed(next, "Squat").sets[0].last).toEqual({ weight: 100, reps: 5, rpe: 8 });
  });

  it("returns the stored plan for a Session, replaced at each Validation", async () => {
    expect(await repo.getPlan(monSession)).toBeNull();
    const first = await repo.startSession(monSession, MON);
    await logEverything(first, { weight: 100, reps: 5, rpe: 8 });
    await repo.validateSession(first, TODAY);
    expect((await repo.getPlan(thuSession))?.source).toBe("rules");
  });

  it("plans next week's occurrence when it is the only Session of the Program", async () => {
    await repo.removeSession(thuSession);
    const first = await repo.startSession(monSession, MON);
    await logEverything(first, { weight: 100, reps: 5, rpe: 8 });
    expect((await repo.validateSession(first, TODAY)).plan).toMatchObject({ sessionId: monSession, date: NEXT_MON });
  });
});
