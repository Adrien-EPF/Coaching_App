import { describe, expect, it } from "vitest";
import { ExerciseInput, LoggedSet, PastSession, planSession } from "../src/planner/planner";
import { DEFAULT_RULES, Rules } from "../src/rules/rules";
import { GoalKey } from "../src/rules/rules";

const TARGET = "2026-10-19";

const set = (weight: number, reps: number, rpe = 8): LoggedSet => ({ weight, reps, rpe, notCompleted: false });
const skipped: LoggedSet = { weight: null, reps: null, rpe: null, notCompleted: true };
const past = (date: string, sets: LoggedSet[], goal: GoalKey = "strength"): PastSession => ({ date, goal, sets });

function exercise(over: Partial<ExerciseInput> = {}): ExerciseInput {
  return { exerciseId: 1, name: "Squat", position: 1, sets: 4, goal: "strength", equipment: "barbell", history: [], ...over };
}

function planOne(over: Partial<ExerciseInput>, rules: Rules = DEFAULT_RULES, date = TARGET) {
  const plan = planSession(rules, { date, exercises: [exercise(over)] });
  return { plan, ex: plan.exercises[0] };
}

describe("a new Exercise", () => {
  it("has no weight yet, starts at the bottom of the window", () => {
    const { ex } = planOne({});
    expect(ex).toMatchObject({ weight: null, reps: 3, sets: 4, reason: null });
  });
});

describe("double progression", () => {
  it("keeps the weight and aims +1 rep on the lowest Set while the top is not reached", () => {
    const { ex } = planOne({ history: [past("2026-10-12", [set(100, 4), set(100, 3), set(100, 3), set(100, 3)])] });
    expect(ex).toMatchObject({ weight: 100, reps: 4, reason: null });
  });

  it("raises the weight when every Set reaches the top, restarting from the bottom", () => {
    const { ex } = planOne({ history: [past("2026-10-12", [set(100, 5), set(100, 5), set(100, 5), set(100, 5)])] });
    expect(ex.weight).toBe(106); // +5% = 105, barbell steps of 2 from a 20 kg bar
    expect(ex.reps).toBe(3);
    expect(ex.reason).toMatch(/hausse/i);
  });

  it("does not raise the weight when a Set was Not Completed", () => {
    const { ex } = planOne({ history: [past("2026-10-12", [set(100, 5), set(100, 5), set(100, 5), skipped])] });
    expect(ex.weight).toBe(100);
  });

  it("holds the weight when the reps were hit at too high an RPE", () => {
    const { ex } = planOne({ history: [past("2026-10-12", [set(100, 5, 8), set(100, 5, 9.5), set(100, 5, 8), set(100, 5, 8)])] });
    expect(ex.weight).toBe(100);
    expect(ex.reps).toBe(5);
  });

  it("endurance ignores the RPE and raises at 20 reps", () => {
    const { ex } = planOne({
      goal: "endurance",
      equipment: "machine",
      sets: 3,
      history: [past("2026-10-12", [set(40, 20, 10), set(40, 20, 10), set(40, 20, 10)], "endurance")],
    });
    expect(ex.weight).toBe(42); // +2.5% = 41, rounded to the machine's 2 kg steps, min one step
    expect(ex.reps).toBe(12);
  });

  it("takes the smallest increment when the percentage rounds to nothing", () => {
    const { ex } = planOne({
      goal: "hypertrophy",
      equipment: "dumbbell",
      sets: 3,
      history: [past("2026-10-12", [set(10, 10), set(10, 10), set(10, 10)], "hypertrophy")],
    });
    expect(ex.weight).toBe(12);
  });

  it("respects the weight belt's plates and maximum load", () => {
    const { ex } = planOne({
      equipment: "weight_belt",
      history: [past("2026-10-12", [set(100, 5), set(100, 5), set(100, 5), set(100, 5)])],
    });
    expect(ex.weight).toBe(100); // capped at 100 kg
  });
});

describe("failure", () => {
  it("first failure: keeps the weight and retries from the bottom", () => {
    const { ex } = planOne({ history: [past("2026-10-12", [set(100, 3), set(100, 2), set(100, 3), set(100, 3)])] });
    expect(ex).toMatchObject({ weight: 100, reps: 3 });
  });

  it("second consecutive failure at the same weight: -10%", () => {
    const { ex } = planOne({
      history: [
        past("2026-10-12", [set(100, 3), set(100, 2), set(100, 3), set(100, 3)]),
        past("2026-10-05", [set(100, 2), set(100, 2), set(100, 3), set(100, 3)]),
      ],
    });
    expect(ex.weight).toBe(90);
    expect(ex.reps).toBe(3);
    expect(ex.reason).toMatch(/baisse/i);
  });

  it("a failure at a different weight does not count as a second one", () => {
    const { ex } = planOne({
      history: [
        past("2026-10-12", [set(100, 3), set(100, 2), set(100, 3), set(100, 3)]),
        past("2026-10-05", [set(96, 2), set(96, 2), set(96, 3), set(96, 3)]),
      ],
    });
    expect(ex.weight).toBe(100);
  });
});

describe("returning after a pause", () => {
  const sets = [set(100, 5), set(100, 5), set(100, 5), set(100, 5)];
  it("under 2 weeks: normal progression", () => {
    const { ex } = planOne({ history: [past("2026-10-12", sets)] });
    expect(ex.weight).toBeGreaterThan(100);
  });
  it("2 to 4 weeks: -10%", () => {
    const { ex } = planOne({ history: [past("2026-09-28", sets)] }); // 21 days
    expect(ex.weight).toBe(90);
    expect(ex.reason).toMatch(/pause/i);
  });
  it("over 4 weeks: -20%, allowed beyond the usual -10% Guardrail", () => {
    const { ex } = planOne({ history: [past("2026-08-24", sets)] });
    expect(ex.weight).toBe(80);
  });
});

describe("range overshoot", () => {
  it("recomputes the load from the Estimated 1RM, capped at +10%", () => {
    const { ex } = planOne({
      goal: "hypertrophy",
      equipment: "machine",
      sets: 3,
      history: [past("2026-10-12", [set(50, 14), set(50, 8), set(50, 8)], "hypertrophy")],
    });
    // Epley: 50 * (1 + 14/30) = 73.3 -> for 6 reps: 61 kg, capped at +10% = 55
    expect(ex.weight).toBe(54);
    expect(ex.reps).toBe(6);
    expect(ex.warnings.join(" ")).toMatch(/limit/i);
  });
});

describe("bodyweight movements", () => {
  it("+1 rep per Set with no weight and no cap", () => {
    const { ex } = planOne({
      equipment: "bodyweight",
      goal: "endurance",
      sets: 3,
      history: [past("2026-10-12", [set(0, 20), set(0, 18), set(0, 15)], "endurance")],
    });
    expect(ex.weight).toBeNull();
    expect(ex.reps).toBe(16); // lowest Set + 1; never clamped to the goal's range
  });
});

describe("goal change", () => {
  it("starts from the Estimated 1RM with a 10% margin, ignoring the +10% cap", () => {
    const { ex } = planOne({
      goal: "strength",
      history: [past("2026-10-12", [set(60, 10), set(60, 10), set(60, 10)], "hypertrophy")],
    });
    // e1RM = 60 * (1 + 10/30) = 80 ; 3 reps -> 80 / 1.1 = 72.7 ; -10% margin = 65.5 -> 66
    expect(ex.weight).toBe(66);
    expect(ex.reps).toBe(3);
    expect(ex.reason).toMatch(/objectif/i);
  });
});

describe("Guardrails", () => {
  it("clamp the number of Sets to the goal's range and say so", () => {
    const { ex } = planOne({ sets: 2 });
    expect(ex.sets).toBe(4);
    expect(ex.warnings.length).toBe(1);
  });

  it("clamp reps to the goal's range", () => {
    const rules: Rules = structuredClone(DEFAULT_RULES);
    rules.goals.strength.default_progression_window = [3, 9]; // a window outside the range
    const { ex } = planOne({ history: [past("2026-10-12", [set(100, 8), set(100, 8), set(100, 8), set(100, 8)])] }, rules);
    expect(ex.reps).toBe(5);
    expect(ex.warnings.length).toBe(1);
  });

  it("never lets the weight rise past +10%, whatever the rule says", () => {
    const rules: Rules = structuredClone(DEFAULT_RULES);
    rules.goals.strength.increase_pct = 30;
    const { ex, plan } = planOne({ history: [past("2026-10-12", [set(100, 5), set(100, 5), set(100, 5), set(100, 5)])] }, rules);
    expect(ex.weight).toBe(110);
    expect(plan.exercises[0].warnings.join(" ")).toMatch(/\+10/);
  });
});

describe("Session Plan", () => {
  it("covers every Exercise, in order, with a one-line summary and the rules-only flag", () => {
    const plan = planSession(DEFAULT_RULES, {
      date: TARGET,
      exercises: [
        exercise({ exerciseId: 1, position: 1, history: [past("2026-10-12", [set(100, 5), set(100, 5), set(100, 5), set(100, 5)])] }),
        exercise({ exerciseId: 2, name: "Curl", position: 2, goal: "hypertrophy", sets: 3, equipment: "dumbbell" }),
      ],
    });
    expect(plan.exercises.map((e) => e.exerciseId)).toEqual([1, 2]);
    expect(plan.source).toBe("rules");
    expect(plan.summary).not.toMatch(/\n/);
    expect(plan.summary.length).toBeGreaterThan(0);
  });

  it("gives a reason only when the weight changes", () => {
    const plan = planSession(DEFAULT_RULES, {
      date: TARGET,
      exercises: [
        exercise({ exerciseId: 1, history: [past("2026-10-12", [set(100, 4), set(100, 4), set(100, 4), set(100, 4)])] }),
      ],
    });
    expect(plan.exercises[0].reason).toBeNull();
  });
});
