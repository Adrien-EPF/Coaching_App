import { beforeEach, describe, expect, it } from "vitest";
import { Repo } from "../src/data/repo";
import { migrate } from "../src/data/schema";
import { askForOneRepMaxes, Generate, OneRmRequest } from "../src/planner/gemini";
import { ExerciseInput, planSession } from "../src/planner/planner";
import { DEFAULT_RULES } from "../src/rules/rules";
import { memoryDb } from "./nodeDb";

const MON = "2026-10-05";

const request = (over: Partial<OneRmRequest> = {}): OneRmRequest => ({
  exerciseId: 1,
  name: "Traction lestée",
  equipment: "weight_belt",
  sets: [{ date: MON, weight: 25, reps: 3, rpe: 9, goal: "strength" }],
  ...over,
});

const answer = (oneRepMax: number, why = "ok"): Generate => async () => JSON.stringify({ estimates: [{ exerciseId: 1, oneRepMax, why }] });

describe("askForOneRepMaxes", () => {
  it("returns Gemini's estimate and its reason", async () => {
    const [e] = await askForOneRepMaxes([request()], answer(29, "3 reps à RPE 9"));
    expect(e).toEqual({ exerciseId: 1, oneRepMax: 29, why: "3 reps à RPE 9" });
  });

  it("never goes below the heaviest weight lifted", async () => {
    const [e] = await askForOneRepMaxes([request()], answer(10));
    expect(e.oneRepMax).toBe(25);
  });

  it("never goes far above the Epley estimate", async () => {
    const [e] = await askForOneRepMaxes([request()], answer(80)); // Epley 27.5, x1.3 = 35.75
    expect(e.oneRepMax).toBe(35.8);
  });

  it("explains itself when there is no key or the answer is unusable", async () => {
    await expect(askForOneRepMaxes([request()], null)).rejects.toThrow(/clé Gemini/);
    await expect(askForOneRepMaxes([request()], async () => "nope")).rejects.toThrow(/exploitable/);
  });
});

describe("Estimated 1RM from Gemini", () => {
  let repo: Repo;
  let generate: Generate | null;

  beforeEach(async () => {
    const db = memoryDb();
    await migrate(db);
    generate = answer(29, "RPE 9 sur 3 reps");
    repo = new Repo(db, DEFAULT_RULES, async () => generate);
    const programId = await repo.createProgram({ name: "Force", cycle: "week", startDate: MON });
    const day = await repo.addSession(programId, { name: "Tractions", slot: 0 });
    await repo.addExercise(day, { name: "Traction lestée", sets: 1, goal: "strength", equipment: "weight_belt" });
    const log = await repo.getSessionLog(await repo.startSession(day, MON));
    await repo.logSet(log.exercises[0].sets[0].id, { weight: 25, reps: 3, rpe: 9 });
    await repo.validateSession(log.id, MON);
  });

  it("is stored and shown next to the Epley estimate", async () => {
    expect(await repo.estimateOneRepMaxesWithGemini(MON)).toBe(1);
    const [p] = await repo.getProgress();
    expect(p.geminiOneRepMax).toMatchObject({ value: 29, why: "RPE 9 sur 3 reps" });
    expect(p.estimatedOneRepMax).toBeCloseTo(27.5);
  });

  it("is absent until asked for, and a second ask replaces the first", async () => {
    expect((await repo.getProgress())[0].geminiOneRepMax).toBeNull();
    await repo.estimateOneRepMaxesWithGemini(MON);
    generate = answer(30);
    await repo.estimateOneRepMaxesWithGemini("2026-10-06");
    expect((await repo.getProgress())[0].geminiOneRepMax).toMatchObject({ value: 30, estimatedAt: "2026-10-06" });
  });
});

describe("planning with a Gemini 1RM", () => {
  const exercise = (over: Partial<ExerciseInput>): ExerciseInput => ({
    exerciseId: 1, name: "Traction lestée", position: 1, sets: 3, goal: "hypertrophy", equipment: "weight_belt", ...over, history: over.history ?? [],
  });
  const history = [{ date: "2026-10-17", goal: "strength" as const, sets: [25, 25, 25].map((weight) => ({ weight, reps: 3, rpe: 9, notCompleted: false })) }];

  it("a first Session in a new goal restarts from it instead of the formula", () => {
    const withGemini = planSession(DEFAULT_RULES, { date: "2026-10-19", exercises: [exercise({ history, oneRepMax: 32 })] }).exercises[0];
    const formula = planSession(DEFAULT_RULES, { date: "2026-10-19", exercises: [exercise({ history })] }).exercises[0];
    // 32 / 1.267 x 0.7 = 17.7 -> 18, against 27.5 / 1.267 x 0.7 = 15.2 -> 15
    expect(withGemini.weight).toBe(18);
    expect(formula.weight).toBe(15);
  });
});
