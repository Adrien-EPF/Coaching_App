import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Repo } from "../src/data/repo";
import { migrate } from "../src/data/schema";
import { Generate } from "../src/planner/gemini";
import { callGemini } from "../src/planner/geminiApi";
import { DEFAULT_RULES } from "../src/rules/rules";
import { memoryDb } from "./nodeDb";

// 2026-10-05 is a Monday. Squat day on Mondays, Front squat day on Thursdays.
const MON = "2026-10-05";
const THU = "2026-10-08";

let answers: string[];
let prompts: string[];
let hasKey: boolean;
let repo: Repo;
let programId: number;
let squatDay: number;
let frontDay: number;

const generate: Generate = async (prompt) => {
  prompts.push(prompt);
  const next = answers.shift();
  if (next === undefined) throw new Error("no more fake answers");
  return next;
};

beforeEach(async () => {
  answers = [];
  prompts = [];
  hasKey = true;
  const db = memoryDb();
  await migrate(db);
  repo = new Repo(db, DEFAULT_RULES, async () => (hasKey ? generate : null));
  programId = await repo.createProgram({ name: "Force", cycle: "week", startDate: MON });
  squatDay = await repo.addSession(programId, { name: "Squat day", slot: 0 });
  frontDay = await repo.addSession(programId, { name: "Front day", slot: 3 });
  await repo.addExercise(squatDay, { name: "Squat", sets: 4, goal: "strength", equipment: "barbell" });
  await repo.addExercise(frontDay, { name: "Front squat", sets: 4, goal: "strength", equipment: "barbell" });
  await repo.addExercise(frontDay, { name: "Presse à cuisses", sets: 3, goal: "hypertrophy", equipment: "machine" });
});

const ids = async () => {
  const all = await repo.listExercises();
  const id = (n: string) => all.find((e) => e.name === n)!.id;
  return { squat: id("Squat"), front: id("Front squat"), press: id("Presse à cuisses") };
};

async function logWholeSession(sessionId: number, date: string, weight: number, reps: number) {
  const log = await repo.getSessionLog(await repo.startSession(sessionId, date));
  for (const e of log.exercises) for (const s of e.sets) await repo.logSet(s.id, { weight, reps, rpe: 8 });
  return log.id;
}

/** Squat day done and validated on Monday; returns Front day, logged on Thursday and ready to validate. */
async function frontDayLogged() {
  hasKey = false;
  await repo.validateSession(await logWholeSession(squatDay, MON, 100, 5), MON);
  hasKey = true;
  return logWholeSession(frontDay, THU, 80, 5);
}

describe("Gemini plan at Validation", () => {
  it("stores the Gemini plan for the next Session", async () => {
    const x = await ids();
    const logId = await frontDayLogged();
    answers.push(JSON.stringify({ summary: "Un peu plus lourd", exercises: [{ exerciseId: x.squat, weight: 102, reps: 3, sets: 4, reason: "Toutes les séries à 5." }] }));
    const { plan } = await repo.validateSession(logId, THU);
    expect(plan).toMatchObject({ source: "gemini", note: null, summary: "Un peu plus lourd" });
    expect(plan!.exercises[0]).toMatchObject({ weight: 102, reps: 3, reason: "Toutes les séries à 5." });
    expect((await repo.getPlan(squatDay))!.source).toBe("gemini");
    expect(prompts).toHaveLength(1);
  });

  it("falls back to the rules-only plan, labeled, when Gemini answers nonsense", async () => {
    const logId = await frontDayLogged();
    answers.push("pas du JSON");
    const { plan } = await repo.validateSession(logId, THU);
    expect(plan).toMatchObject({ source: "rules" });
    expect(plan!.note).toMatch(/Gemini/);
    expect(plan!.exercises[0].weight).toBeGreaterThan(100); // the Rules raise the weight
  });

  it("falls back, labeled, when there is no key", async () => {
    const logId = await frontDayLogged();
    hasKey = false;
    const { plan } = await repo.validateSession(logId, THU);
    expect(plan).toMatchObject({ source: "rules" });
    expect(plan!.note).toMatch(/clé/);
    expect(prompts).toHaveLength(0);
  });
});

describe("Initial Weights", () => {
  it("lists the Exercises with no history, with their position in the Session", async () => {
    const list = await repo.exercisesWithoutHistory(programId);
    expect(list.map((e) => [e.name, e.position, e.sessionSize])).toEqual([
      ["Squat", 1, 1],
      ["Front squat", 1, 2],
      ["Presse à cuisses", 2, 2],
    ]);
    hasKey = false;
    await repo.validateSession(await logWholeSession(squatDay, MON, 100, 5), MON);
    expect((await repo.exercisesWithoutHistory(programId)).map((e) => e.name)).toEqual(["Front squat", "Presse à cuisses"]);
  });

  it("entered by hand at Program creation, they become the plan of the Sessions", async () => {
    const x = await ids();
    await repo.setStartingWeights(
      [
        { exerciseId: x.squat, weight: 100, reps: 5 },
        { exerciseId: x.front, weight: 80, reps: 4 },
      ],
      "manual",
      MON,
    );
    expect(await repo.getPlan(squatDay)).toMatchObject({ date: MON, source: "rules" });
    expect((await repo.getPlan(squatDay))!.exercises[0]).toMatchObject({ weight: 100, reps: 5 });
    expect((await repo.getPlan(frontDay))!.exercises.find((e) => e.exerciseId === x.front)).toMatchObject({ weight: 80, reps: 4 });
    // Logging the Session starts from them.
    const log = await repo.getSessionLog(await repo.startSession(squatDay, MON));
    expect(log.exercises[0].sets[0]).toMatchObject({ plannedWeight: 100, plannedReps: 5 });
  });

  it("rejects a weight that is not a number, and zero reps", async () => {
    const x = await ids();
    await expect(repo.setStartingWeights([{ exerciseId: x.squat, weight: -5, reps: 5 }], "manual", MON)).rejects.toThrow();
    await expect(repo.setStartingWeights([{ exerciseId: x.squat, weight: 100, reps: 0 }], "manual", MON)).rejects.toThrow();
  });

  it("are used only until the Exercise has history", async () => {
    const x = await ids();
    await repo.setStartingWeights([{ exerciseId: x.squat, weight: 100, reps: 5 }], "manual", MON);
    const logId = await logWholeSession(squatDay, MON, 60, 5);
    hasKey = false;
    const { plan } = await repo.validateSession(logId, MON);
    expect(plan!.exercises[0].weight).not.toBe(100);
  });
});

describe("Starting Estimates", () => {
  it("asks Gemini about the Exercises with no history, with their position and the related history", async () => {
    const x = await ids();
    const logId = await logWholeSession(squatDay, MON, 100, 5);
    hasKey = false;
    await repo.validateSession(logId, MON); // Squat now has history
    hasKey = true;
    answers.push(
      JSON.stringify({
        loads: [
          { exerciseId: x.front, weight: 78, reps: 3, sets: 4, why: "D'après ton squat, en 1re position." },
          { exerciseId: x.press, weight: 140, reps: 8, sets: 3, why: "Après le front squat." },
        ],
      }),
    );
    const estimates = await repo.proposeEstimates(programId);
    expect(estimates.map((e) => [e.name, e.weight, e.reps])).toEqual([
      ["Front squat", 78, 3],
      ["Presse à cuisses", 140, 8],
    ]);
    expect(prompts[0]).toContain('"position": 2');
    expect(prompts[0]).toContain('"name": "Squat"'); // the related movement, with its history
  });

  it("changes nothing until approved; approving makes them the starting loads", async () => {
    const x = await ids();
    answers.push(JSON.stringify({ loads: [{ exerciseId: x.squat, weight: 90, reps: 5, sets: 4, why: "x" }, { exerciseId: x.front, weight: 70, reps: 5, sets: 4, why: "x" }, { exerciseId: x.press, weight: 100, reps: 8, sets: 3, why: "x" }] }));
    const estimates = await repo.proposeEstimates(programId);
    expect(await repo.getPlan(squatDay)).toBeNull();
    await repo.setStartingWeights(estimates.map((e) => ({ exerciseId: e.exerciseId, weight: e.weight, reps: e.reps })), "estimate", MON);
    expect((await repo.getPlan(squatDay))!.exercises[0]).toMatchObject({ weight: 90, reps: 5 });
  });

  it("explains itself when Gemini is not available", async () => {
    hasKey = false;
    await expect(repo.proposeEstimates(programId)).rejects.toThrow(/clé/);
  });
});

describe("Test Session", () => {
  it("is planned by Gemini for the Exercises with no history, once, on the given day", async () => {
    const x = await ids();
    answers.push(
      JSON.stringify({
        loads: [
          { exerciseId: x.squat, weight: 60, reps: 5, sets: 4, why: "x" },
          { exerciseId: x.front, weight: 50, reps: 5, sets: 4, why: "x" },
          { exerciseId: x.press, weight: 80, reps: 8, sets: 3, why: "x" },
        ],
      }),
    );
    const test = await repo.createTestSession(programId, THU);
    expect(test.date).toBe(THU);

    const days = await repo.getCalendar(THU, "2026-10-30", THU);
    const appearances = days.flatMap((d) => d.items.filter((i) => i.type === "planned" && i.sessionId === test.sessionId).map(() => d.date));
    expect(appearances).toEqual([THU]);

    const plan = await repo.getPlan(test.sessionId);
    expect(plan!.source).toBe("gemini");
    expect(plan!.exercises.map((e) => [e.name, e.weight, e.reps, e.sets])).toEqual([
      ["Squat", 60, 5, 4],
      ["Front squat", 50, 5, 4],
      ["Presse à cuisses", 80, 8, 3],
    ]);
  });

  it("is logged like any Session, and its Sets feed the next plans", async () => {
    const x = await ids();
    answers.push(
      JSON.stringify({ loads: [{ exerciseId: x.squat, weight: 60, reps: 5, sets: 4, why: "x" }, { exerciseId: x.front, weight: 50, reps: 5, sets: 4, why: "x" }, { exerciseId: x.press, weight: 80, reps: 8, sets: 3, why: "x" }] }),
    );
    const test = await repo.createTestSession(programId, MON);
    const log = await repo.getSessionLog(await repo.startSession(test.sessionId, MON));
    expect(log.exercises.map((e) => e.sets.length)).toEqual([4, 4, 3]);
    expect(log.exercises[0].sets[0]).toMatchObject({ plannedWeight: 60, plannedReps: 5 });
    for (const e of log.exercises) for (const s of e.sets) await repo.logSet(s.id, { weight: s.plannedWeight, reps: s.plannedReps!, rpe: 7 });
    hasKey = false;
    const { plan } = await repo.validateSession(log.id, MON);
    expect(plan).not.toBeNull();
    expect((await repo.exercisesWithoutHistory(programId)).length).toBe(0);
  });

  it("does not show in the Program's own Sessions", async () => {
    const x = await ids();
    answers.push(JSON.stringify({ loads: [{ exerciseId: x.squat, weight: 60, reps: 5, sets: 4, why: "x" }, { exerciseId: x.front, weight: 50, reps: 5, sets: 4, why: "x" }, { exerciseId: x.press, weight: 80, reps: 8, sets: 3, why: "x" }] }));
    await repo.createTestSession(programId, MON);
    expect((await repo.getProgramDetail(programId)).sessions.map((s) => s.name)).toEqual(["Squat day", "Front day"]);
  });

  it("explains itself when Gemini is not available", async () => {
    hasKey = false;
    await expect(repo.createTestSession(programId, MON)).rejects.toThrow(/clé/);
    expect((await repo.getProgramDetail(programId)).sessions).toHaveLength(2);
  });
});

describe("the Gemini call", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the key only to the Gemini endpoint, in a header", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await callGemini("SECRET-KEY", "hello");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).host).toBe("generativelanguage.googleapis.com");
    expect(url).not.toContain("SECRET-KEY");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("SECRET-KEY");
    expect(String(init.body)).not.toContain("SECRET-KEY");
  });

  it("fails on an HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 403 })));
    await expect(callGemini("k", "hello")).rejects.toThrow();
  });
});
