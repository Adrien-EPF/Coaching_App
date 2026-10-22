/** The versioned Rules config. Its shape mirrors the YAML block at the bottom of RULES.md. */
export type GoalKey = "strength" | "hypertrophy" | "endurance";

export interface GoalRules {
  reps_range: [number, number];
  /** Double-progression window, when narrower than the whole range. */
  default_progression_window?: [number, number];
  sets: [number, number];
  increase_pct: number;
  /** Reps hit above this RPE do not earn an increase. null: RPE never brakes. */
  max_rpe_to_increase: number | null;
  target_rpe?: [number, number];
  progression?: string;
  increase_when?: string;
}

export interface EquipmentRules {
  min_step: number;
  bar_weight?: number;
  plates?: number[];
  min_load?: number;
  max_load?: number;
  rounding?: string;
}

export interface Rules {
  version: number;
  aim: string;
  common: {
    model: string;
    success: string;
    increase: { rounding: string; min_step: string };
    failure: {
      definition: string;
      retries_before_decrease: number;
      decrease_after_consecutive_failures: number;
      decrease_pct: number;
      reset_reps_to: string;
    };
    deload: { scheduled: boolean };
    problem_report: { allow_increase: boolean };
  };
  special_cases: {
    pause: { max_days: number | null; decrease_pct: number }[];
    range_overshoot: { trigger: string; reps: number; new_load: string; capped_by_guardrail: boolean; rpe_brake_applies: boolean };
    bodyweight_no_load: { progression: string; reps_cap: number | null };
    timed_hold: { progression: string; step_seconds: number };
    goal_change: { start_load: string; target_reps: string; safety_margin_pct: { to_more_reps: number; to_fewer_reps: number }; exempt_from_max_increase: boolean };
    unplanned_session: { counts_for_progression: boolean; visible_to_gemini: boolean };
  };
  guardrails: {
    max_increase_pct: number;
    max_increase_floor: string;
    max_decrease_pct: number;
    max_decrease_pct_after_long_pause: number;
    reps_within_goal_range: boolean;
    sets_within_goal_range: boolean;
    fallback: string;
  };
  goals: Record<GoalKey, GoalRules>;
  rpe_scale: Record<string, string>;
  increments: Record<string, EquipmentRules>;
  /** Free-text principles, for Gemini. */
  principles?: string[];
}

/** A movement with no load to progress (plain pull-up), as opposed to the keys of `increments`. */
export const BODYWEIGHT = "bodyweight";

/** A held position with no load (plank): the logged number is seconds, stored where reps are. */
export const TIMED = "timed";

/** No load to log or progress: plain bodyweight reps, or a hold timed in seconds. */
export const hasNoLoad = (equipment: string) => equipment === BODYWEIGHT || equipment === TIMED;

export const DEFAULT_RULES: Rules = {
  version: 1,
  aim: "performance",
  common: {
    model: "double_progression",
    success: "all_sets_reach_top",
    increase: { rounding: "available_increments", min_step: "smallest_available_increment" },
    failure: {
      definition: "any_set_below_range_bottom",
      retries_before_decrease: 1,
      decrease_after_consecutive_failures: 2,
      decrease_pct: 10,
      reset_reps_to: "range_bottom",
    },
    deload: { scheduled: false },
    problem_report: { allow_increase: false },
  },
  special_cases: {
    pause: [
      { max_days: 13, decrease_pct: 0 },
      { max_days: 28, decrease_pct: 10 },
      { max_days: null, decrease_pct: 20 },
    ],
    range_overshoot: {
      trigger: "first_set_reps_above_top_by_at_least",
      reps: 2,
      new_load: "from_estimated_1rm_epley",
      capped_by_guardrail: true,
      rpe_brake_applies: true,
    },
    bodyweight_no_load: { progression: "plus_one_rep_per_set", reps_cap: null },
    timed_hold: { progression: "plus_step_seconds_per_set", step_seconds: 5 },
    goal_change: {
      start_load: "from_estimated_1rm_epley",
      target_reps: "new_range_bottom",
      safety_margin_pct: { to_more_reps: 30, to_fewer_reps: 10 },
      exempt_from_max_increase: true,
    },
    unplanned_session: { counts_for_progression: false, visible_to_gemini: true },
  },
  guardrails: {
    max_increase_pct: 10,
    max_increase_floor: "smallest_available_increment",
    max_decrease_pct: 10,
    max_decrease_pct_after_long_pause: 20,
    reps_within_goal_range: true,
    sets_within_goal_range: true,
    fallback: "rules_only",
  },
  goals: {
    strength: {
      reps_range: [1, 5],
      default_progression_window: [3, 5],
      sets: [4, 6],
      increase_pct: 5,
      max_rpe_to_increase: 9,
    },
    hypertrophy: { reps_range: [8, 12], sets: [3, 3], increase_pct: 2.5, max_rpe_to_increase: 9 },
    endurance: {
      reps_range: [12, 20],
      sets: [2, 3],
      increase_pct: 2.5,
      target_rpe: [9, 10],
      max_rpe_to_increase: null,
      progression: "max_reps_at_fixed_load",
      increase_when: "all_sets_reach_top",
    },
  },
  rpe_scale: {
    "10": "Aucune rep de plus possible",
    "9.5": "Peut-être une rep de plus",
    "9": "1 rep de plus possible",
    "8.5": "Peut-être 2 reps de plus",
    "8": "2 reps de plus possibles",
    "7": "3 reps de plus possibles",
    "6": "4 reps de plus ou plus, effort léger",
  },
  increments: {
    weight_belt: { plates: [1, 2.5, 5, 10, 20], min_step: 1, min_load: 0, max_load: 100 },
    barbell: { bar_weight: 20, min_step: 2 },
    dumbbell: { min_step: 2 },
    machine: { min_step: 2, rounding: "nearest_available" },
    cable: { min_step: 2, rounding: "nearest_available" },
  },
};

/** Free-text principles for Gemini, kept out of the structured config. */
export const DEFAULT_PRINCIPLES: string[] = [
  "Un seul but : la performance (plus de charge, plus de reps), jamais l'apparence.",
  "Mauvais sommeil ou douleur signalés : garder ou baisser la charge, ne jamais la monter.",
  "Un exercice en fin de séance peut rester à la même charge si la fatigue explique un manque de reps.",
  "Les objectifs peuvent orienter le plan, jamais l'accélérer au-delà des Guardrails.",
];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function need(cond: boolean, path: string, what: string): asserts cond {
  if (!cond) throw new Error(`Rules invalides : ${path} ${what}.`);
}

function pair(v: unknown, path: string): [number, number] {
  need(Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number"), path, "doit être [min, max]");
  need(v[0] <= v[1], path, "doit avoir min ≤ max");
  return v as [number, number];
}

/** Checks a parsed Rules config (from YAML or JSON) and returns it typed. Throws a readable error otherwise. */
export function loadRules(raw: unknown): Rules {
  need(isObject(raw), "racine", "doit être un objet");
  need(Number.isInteger(raw.version) && (raw.version as number) >= 1, "version", "doit être un entier ≥ 1");
  need(isObject(raw.common) && isObject(raw.special_cases) && isObject(raw.guardrails), "common / special_cases / guardrails", "manquants");

  const g = raw.guardrails as Record<string, unknown>;
  for (const k of ["max_increase_pct", "max_decrease_pct", "max_decrease_pct_after_long_pause"]) {
    need(typeof g[k] === "number" && (g[k] as number) >= 0, `guardrails.${k}`, "doit être un nombre ≥ 0");
  }

  need(isObject(raw.goals), "goals", "manquant");
  const goals = raw.goals as Record<string, unknown>;
  for (const key of ["strength", "hypertrophy", "endurance"]) {
    const goal = goals[key];
    need(isObject(goal), `goals.${key}`, "manquant");
    pair(goal.reps_range, `goals.${key}.reps_range`);
    pair(goal.sets, `goals.${key}.sets`);
    if (goal.default_progression_window !== undefined) pair(goal.default_progression_window, `goals.${key}.default_progression_window`);
    need(typeof goal.increase_pct === "number" && goal.increase_pct > 0, `goals.${key}.increase_pct`, "doit être un nombre > 0");
    need(goal.max_rpe_to_increase === null || typeof goal.max_rpe_to_increase === "number", `goals.${key}.max_rpe_to_increase`, "doit être un nombre ou null");
  }

  need(isObject(raw.increments), "increments", "manquant");
  const incs = raw.increments as Record<string, unknown>;
  for (const [name, inc] of Object.entries(incs)) {
    need(isObject(inc) && typeof inc.min_step === "number" && inc.min_step > 0, `increments.${name}.min_step`, "doit être un nombre > 0");
  }

  const pause = (raw.special_cases as Record<string, unknown>).pause;
  need(Array.isArray(pause) && pause.length > 0, "special_cases.pause", "doit être une liste non vide");
  const last = pause[pause.length - 1];
  need(isObject(last) && last.max_days === null, "special_cases.pause", "doit finir par une entrée max_days: null");

  return raw as unknown as Rules;
}
