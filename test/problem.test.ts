import { beforeEach, describe, expect, it } from "vitest";
import { Repo } from "../src/data/repo";
import { migrate } from "../src/data/schema";
import { Generate } from "../src/planner/gemini";
import { memoryDb } from "./nodeDb";

const MON = "2026-10-05";
const THU = "2026-10-08";
const NEXT_MON = "2026-10-12";

let repo: Repo;
let prompts: string[];
let reply: (prompt: string) => string;
let monSession: number;
let thuSession: number;

// Gemini asks for a heavier squat (106) whatever is said; the Guardrails and the Problem Report must bound it.
const heavy = (weight: number) => JSON.stringify({ summary: "Plan", exercises: [{ exerciseId: 1, weight, reps: 3, sets: 4, reason: "Hausse" }] });

beforeEach(async () => {
  prompts = [];
  reply = () => heavy(106);
  const generate: Generate = async (p) => {
    prompts.push(p);
    return reply(p);
  };
  const db = memoryDb();
  await migrate(db);
  repo = new Repo(db, undefined, async () => generate);
  const programId = await repo.createProgram({ name: "Force", cycle: "week", startDate: MON });
  monSession = await repo.addSession(programId, { name: "Squat day", slot: 0 });
  thuSession = await repo.addSession(programId, { name: "Bench day", slot: 3 });
  await repo.addExercise(monSession, { name: "Squat", sets: 4, goal: "strength", equipment: "barbell" });
  await repo.addExercise(thuSession, { name: "Bench", sets: 4, goal: "strength", equipment: "barbell" });
});

async function logSquat(date: string, weight: number, reps: number) {
  const logId = await repo.startSession(monSession, date);
  for (const s of (await repo.getSessionLog(logId)).exercises[0].sets) await repo.logSet(s.id, { weight, reps, rpe: 8 });
  return logId;
}

/** Validates Monday's Squat day so that a plan exists for Thursday, then asks for next Monday's plan. */
async function planNextMonday() {
  const logId = await logSquat(MON, 100, 5);
  await repo.validateSession(logId, MON);
  return logId;
}

describe("Problem Report", () => {
  it("regenerates the Session Plan with the note sent to Gemini", async () => {
    await planNextMonday();
    prompts.length = 0;
    const plan = await repo.reportProblem(thuSession, THU, { kinds: ["Mauvais sommeil"], details: "5 h de sommeil" });
    expect(plan).not.toBeNull();
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("Mauvais sommeil");
    expect(prompts[0]).toContain("5 h de sommeil");
  });

  it("withdraws a report and plans the Session again without its note", async () => {
    await planNextMonday();
    await repo.reportProblem(thuSession, THU, { kinds: ["Mauvais sommeil"], details: "5 h de sommeil" });
    const [report] = await repo.getProblemReports(thuSession, THU);
    prompts.length = 0;
    await repo.removeProblemReport(report.id);
    const plan = await repo.replanSession(thuSession, THU);
    expect(plan).not.toBeNull();
    expect(await repo.getProblemReports(thuSession, THU)).toEqual([]);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).not.toContain("Mauvais sommeil");
  });

  it("lists the reports of an upcoming Session", async () => {
    await repo.reportProblem(thuSession, THU, { kinds: ["Douleur"], details: "Épaule" });
    expect(await repo.getProblemReports(thuSession, THU)).toMatchObject([{ kinds: ["Douleur"], details: "Épaule" }]);
    expect(await repo.getProblemReports(thuSession, "2026-10-15")).toEqual([]);
  });

  it("never raises the load of an Exercise with a history, whatever Gemini says", async () => {
    const logId = await logSquat(MON, 100, 5);
    await repo.validateSession(logId, MON);
    const plan = await repo.reportProblem(monSession, NEXT_MON, { kinds: ["Fatigue"], details: "" });
    expect(plan!.exercises[0].weight).toBe(100);
    expect(plan!.exercises[0].warnings.join(" ")).toMatch(/problème/i);
  });

  it("lets Gemini lower the load", async () => {
    const logId = await logSquat(MON, 100, 5);
    await repo.validateSession(logId, MON);
    reply = () => heavy(96);
    const plan = await repo.reportProblem(monSession, NEXT_MON, { kinds: ["Malade"], details: "" });
    expect(plan!.exercises[0].weight).toBe(96);
  });

  it("keeps the report when the Rules alone plan (no Gemini key)", async () => {
    const db = memoryDb();
    await migrate(db);
    const local = new Repo(db);
    const programId = await local.createProgram({ name: "P", cycle: "week", startDate: MON });
    const s = await local.addSession(programId, { name: "S", slot: 0 });
    await local.addExercise(s, { name: "Squat", sets: 4, goal: "strength", equipment: "barbell" });
    const logId = await local.startSession(s, MON);
    for (const set of (await local.getSessionLog(logId)).exercises[0].sets) await local.logSet(set.id, { weight: 100, reps: 5, rpe: 8 });
    await local.validateSession(logId, MON);
    const plan = await local.reportProblem(s, NEXT_MON, { kinds: ["Stress"], details: "" });
    expect(plan!.source).toBe("rules");
    expect(plan!.exercises[0].weight).toBe(100);
  });

  it("applies when the next Session is planned by a later Validation", async () => {
    await repo.reportProblem(thuSession, THU, { kinds: ["Mauvais sommeil"], details: "" });
    prompts.length = 0;
    await planNextMonday(); // plans Thursday
    expect(prompts.at(-1)).toContain("Mauvais sommeil");
  });

  it("rejects an empty report and a Session already validated", async () => {
    await expect(repo.reportProblem(thuSession, THU, { kinds: [], details: "  " })).rejects.toThrow();
    await planNextMonday();
    await expect(repo.reportProblem(monSession, MON, { kinds: ["Douleur"], details: "" })).rejects.toThrow(/validée/);
  });
});

describe("editing a validated Session", () => {
  it("re-plans the next Session from the corrected numbers", async () => {
    await repo.removeSession(thuSession); // the next Session is next Monday's Squat day
    const logId = await logSquat(MON, 100, 5);
    await repo.validateSession(logId, MON);
    const set = (await repo.getSessionLog(logId)).exercises[0].sets[0];
    const plan = await repo.editValidatedSet(set.id, { weight: 80, reps: 5, rpe: 8 }, MON);
    expect(plan?.sessionId).toBe(monSession);
    expect(prompts.at(-1)).toContain('"weight": 80');
    expect((await repo.getSessionLog(logId)).exercises[0].sets[0]).toMatchObject({ weight: 80, reps: 5 });
    expect((await repo.getSessionLog(logId)).status).toBe("validated");
  });

  it("can mark a Set Not Completed, and refuses to edit an open Session this way", async () => {
    const logId = await logSquat(MON, 100, 5);
    await expect(repo.editValidatedSet((await repo.getSessionLog(logId)).exercises[0].sets[0].id, { weight: 90, reps: 5, rpe: 8 }, MON)).rejects.toThrow();
    await repo.validateSession(logId, MON);
    const set = (await repo.getSessionLog(logId)).exercises[0].sets[1];
    await repo.editValidatedSet(set.id, "notCompleted", MON);
    expect((await repo.getSessionLog(logId)).exercises[0].sets[1]).toMatchObject({ notCompleted: true, reps: null });
  });

  it("rejects invalid numbers", async () => {
    const logId = await logSquat(MON, 100, 5);
    await repo.validateSession(logId, MON);
    const set = (await repo.getSessionLog(logId)).exercises[0].sets[0];
    await expect(repo.editValidatedSet(set.id, { weight: 100, reps: 0, rpe: 8 }, MON)).rejects.toThrow();
  });
});
