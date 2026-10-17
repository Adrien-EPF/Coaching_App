import { describe, expect, it } from "vitest";
import { ExerciseInput, PastSession } from "../src/planner/planner";
import { askForLoads, LoadRequest, planWithGemini } from "../src/planner/gemini";
import { DEFAULT_RULES } from "../src/rules/rules";

const rules = DEFAULT_RULES;
const DATE = "2026-10-12";

const past = (date: string, weight: number, reps: number[]): PastSession => ({
  date,
  goal: "strength",
  sets: reps.map((r) => ({ weight, reps: r, rpe: 8, notCompleted: false })),
});

const squat: ExerciseInput = {
  exerciseId: 1,
  name: "Squat",
  position: 1,
  sets: 4,
  goal: "strength",
  equipment: "barbell",
  // All Sets at the top of the 3-5 window: the Rules would raise the weight.
  history: [past("2026-10-05", 100, [5, 5, 5, 5])],
};
const curl: ExerciseInput = {
  exerciseId: 2,
  name: "Curl",
  position: 2,
  sets: 3,
  goal: "hypertrophy",
  equipment: "dumbbell",
  history: [past("2026-10-05", 14, [10, 10, 10])],
};

/** A fake Gemini: records the prompt and answers with what the test hands it. */
function fake(answer: string | Error) {
  const prompts: string[] = [];
  const generate = async (prompt: string) => {
    prompts.push(prompt);
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { generate, prompts };
}

const reply = (exercises: object[], summary: string | undefined = "Séance un peu plus lourde") => JSON.stringify({ summary, exercises });

describe("Gemini Session Plan", () => {
  it("turns valid Gemini JSON into the Session Plan", async () => {
    const { generate } = fake(
      reply([
        { exerciseId: 1, weight: 102, reps: 3, sets: 4, reason: "Toutes les séries à 5 reps." },
        { exerciseId: 2, weight: 14, reps: 10, sets: 3, reason: null },
      ]),
    );
    const plan = await planWithGemini(rules, { date: DATE, exercises: [squat, curl] }, generate);
    expect(plan.source).toBe("gemini");
    expect(plan.note).toBeNull();
    expect(plan.summary).toBe("Séance un peu plus lourde");
    expect(plan.exercises[0]).toMatchObject({ exerciseId: 1, weight: 102, reps: 3, sets: 4, reason: "Toutes les séries à 5 reps.", warnings: [] });
    expect(plan.exercises[1]).toMatchObject({ exerciseId: 2, weight: 14, reps: 10 });
  });

  it("sends the last 6 Sessions per Exercise, the Rules and the notes", async () => {
    const many = Array.from({ length: 8 }, (_, i) => past(`2026-09-${String(10 + i).padStart(2, "0")}`, 90 + i, [5, 5, 5, 5])).reverse();
    const { generate, prompts } = fake(reply([{ exerciseId: 1, weight: 100, reps: 4, sets: 4, reason: null }]));
    await planWithGemini(rules, { date: DATE, exercises: [{ ...squat, history: many }], notes: ["Mal dormi"] }, generate);
    const prompt = prompts[0];
    expect(prompt).toContain("Mal dormi");
    expect(prompt).toContain("max_increase_pct");
    expect(prompt).toContain('"exerciseId": 1');
    expect(prompt.match(/"date":/g)).toHaveLength(6);
  });

  it("clamps an out-of-range weight to the Guardrails and warns", async () => {
    const { generate } = fake(reply([{ exerciseId: 1, weight: 140, reps: 4, sets: 4, reason: "Gros saut" }, { exerciseId: 2, weight: 14, reps: 10, sets: 3, reason: null }]));
    const plan = await planWithGemini(rules, { date: DATE, exercises: [squat, curl] }, generate);
    expect(plan.source).toBe("gemini");
    const max = rules.guardrails.max_increase_pct;
    expect(plan.exercises[0].weight).toBeLessThanOrEqual(100 * (1 + max / 100));
    expect(plan.exercises[0].weight).toBeGreaterThan(100);
    expect(plan.exercises[0].warnings.join(" ")).toContain("Guardrail");
  });

  it("clamps reps and sets to the Training Goal's range", async () => {
    const { generate } = fake(reply([{ exerciseId: 1, weight: 100, reps: 20, sets: 12, reason: null }, { exerciseId: 2, weight: 14, reps: 10, sets: 3, reason: null }]));
    const plan = await planWithGemini(rules, { date: DATE, exercises: [squat, curl] }, generate);
    const [lo, hi] = rules.goals.strength.reps_range;
    expect(plan.exercises[0].reps).toBeLessThanOrEqual(hi);
    expect(plan.exercises[0].reps).toBeGreaterThanOrEqual(lo);
    expect(plan.exercises[0].sets).toBeLessThanOrEqual(rules.goals.strength.sets[1]);
    expect(plan.exercises[0].warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps a reason only where the weight changed", async () => {
    const { generate } = fake(
      reply([
        { exerciseId: 1, weight: 100, reps: 4, sets: 4, reason: "Je garde la charge." },
        { exerciseId: 2, weight: 15, reps: 10, sets: 3, reason: "Hausse de 1 kg." },
      ]),
    );
    const plan = await planWithGemini(rules, { date: DATE, exercises: [squat, curl] }, generate);
    expect(plan.exercises[0].reason).toBeNull();
    expect(plan.exercises[1].reason).toBe("Hausse de 1 kg.");
  });

  it("accepts JSON wrapped in a code fence", async () => {
    const { generate } = fake("```json\n" + reply([{ exerciseId: 1, weight: 100, reps: 4, sets: 4, reason: null }]) + "\n```");
    const plan = await planWithGemini(rules, { date: DATE, exercises: [squat] }, generate);
    expect(plan.source).toBe("gemini");
  });

  describe("falls back to the rules-only plan, labeled", () => {
    const rulesOnly = async () => (await planWithGemini(rules, { date: DATE, exercises: [squat] }, null)).exercises[0];

    it.each([
      ["not JSON", "désolé, je ne peux pas"],
      ["an Exercise missing", reply([])],
      ["a weight that is not a number", reply([{ exerciseId: 1, weight: "lourd", reps: 4, sets: 4, reason: null }])],
      ["a negative weight", reply([{ exerciseId: 1, weight: -5, reps: 4, sets: 4, reason: null }])],
      ["reps that are not an integer", reply([{ exerciseId: 1, weight: 100, reps: 4.5, sets: 4, reason: null }])],
      ["an unknown Exercise", reply([{ exerciseId: 1, weight: 100, reps: 4, sets: 4, reason: null }, { exerciseId: 99, weight: 1, reps: 1, sets: 1, reason: null }])],
    ])("on malformed output: %s", async (_label, answer) => {
      const { generate } = fake(answer);
      const plan = await planWithGemini(rules, { date: DATE, exercises: [squat] }, generate);
      expect(plan.source).toBe("rules");
      expect(plan.note).toMatch(/Gemini/);
      expect(plan.exercises[0]).toEqual(await rulesOnly());
    });

    it("when the call fails", async () => {
      const { generate } = fake(new Error("réseau"));
      const plan = await planWithGemini(rules, { date: DATE, exercises: [squat] }, generate);
      expect(plan.source).toBe("rules");
      expect(plan.note).toMatch(/Gemini/);
    });

    it("when there is no Gemini to ask (no key)", async () => {
      const plan = await planWithGemini(rules, { date: DATE, exercises: [squat] }, null);
      expect(plan.source).toBe("rules");
      expect(plan.note).toMatch(/clé/);
    });
  });
});

describe("loads asked from Gemini (Starting Estimates and Test Session)", () => {
  const requests: LoadRequest[] = [
    {
      exerciseId: 10,
      name: "Front squat",
      goal: "strength",
      equipment: "barbell",
      position: 1,
      sessionSize: 3,
      sets: 4,
      related: [{ name: "Squat", equipment: "barbell", history: [past("2026-10-05", 100, [5, 5, 5, 5])] }],
    },
    { exerciseId: 11, name: "Presse à cuisses", goal: "hypertrophy", equipment: "machine", position: 2, sessionSize: 3, sets: 3, related: [] },
  ];

  it("returns a weight, reps and a why per Exercise", async () => {
    const { generate } = fake(
      JSON.stringify({
        loads: [
          { exerciseId: 10, weight: 78, reps: 3, sets: 4, why: "D'après ton squat, en 1re position." },
          { exerciseId: 11, weight: 140, reps: 8, sets: 3, why: "Après le front squat." },
        ],
      }),
    );
    const loads = await askForLoads(rules, "estimate", requests, generate);
    expect(loads).toEqual([
      { exerciseId: 10, weight: 78, reps: 3, sets: 4, why: "D'après ton squat, en 1re position." },
      { exerciseId: 11, weight: 140, reps: 8, sets: 3, why: "Après le front squat." },
    ]);
  });

  it("tells Gemini each Exercise's position in the Session and the related history", async () => {
    const { generate, prompts } = fake(JSON.stringify({ loads: requests.map((r) => ({ exerciseId: r.exerciseId, weight: 50, reps: 8, sets: r.sets, why: "x" })) }));
    await askForLoads(rules, "estimate", requests, generate);
    expect(prompts[0]).toContain('"position": 1');
    expect(prompts[0]).toContain('"sessionSize": 3');
    expect(prompts[0]).toContain("Squat");
  });

  it("snaps weights to the equipment and clamps reps and sets to the Training Goal", async () => {
    const { generate } = fake(
      JSON.stringify({
        loads: [
          { exerciseId: 10, weight: 78.3, reps: 30, sets: 9, why: "x" },
          { exerciseId: 11, weight: 141, reps: 8, sets: 3, why: "x" },
        ],
      }),
    );
    const [a, b] = await askForLoads(rules, "test", requests, generate);
    expect(a.weight! % rules.increments.barbell.min_step).toBeCloseTo(0, 6);
    expect(a.reps).toBe(rules.goals.strength.reps_range[1]);
    expect(a.sets).toBe(rules.goals.strength.sets[1]);
    expect(b.weight! % rules.increments.machine.min_step).toBeCloseTo(0, 6);
  });

  it("rejects malformed output and failures with a readable error", async () => {
    await expect(askForLoads(rules, "estimate", requests, fake("n'importe quoi").generate)).rejects.toThrow(/Gemini/);
    await expect(askForLoads(rules, "estimate", requests, fake(new Error("réseau")).generate)).rejects.toThrow(/Gemini/);
    await expect(askForLoads(rules, "estimate", requests, null)).rejects.toThrow(/clé/);
    await expect(askForLoads(rules, "estimate", requests, fake(JSON.stringify({ loads: [] })).generate)).rejects.toThrow(/Gemini/);
  });
});
