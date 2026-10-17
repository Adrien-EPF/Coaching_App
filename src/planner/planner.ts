import { diffDays, IsoDate } from "../domain/dates";
import { BODYWEIGHT, EquipmentRules, GoalKey, Rules } from "../rules/rules";

/** One logged Set as the planner sees it. A bodyweight Set may have no weight. */
export interface LoggedSet {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  notCompleted: boolean;
}

/** An Exercise as done in one past Session, with the Training Goal it had then. */
export interface PastSession {
  date: IsoDate;
  goal: GoalKey;
  sets: LoggedSet[];
}

export interface ExerciseInput {
  exerciseId: number;
  name: string;
  /** 1-based position in the Session. */
  position: number;
  /** Sets prescribed by the Program. */
  sets: number;
  goal: GoalKey;
  /** A key of the Rules' `increments`, or "bodyweight". */
  equipment: string;
  /** Validated Sessions of this Exercise, newest first. */
  history: PastSession[];
  /** Initial Weight or approved Starting Estimate, used while there is no history. */
  start?: StartingLoad | null;
}

export interface StartingLoad {
  /** null: bodyweight. */
  weight: number | null;
  reps: number;
}

export interface PlannedExercise {
  exerciseId: number;
  /** null: nothing to load yet (new Exercise) or bodyweight. */
  weight: number | null;
  reps: number;
  sets: number;
  /** Only when the weight changed from last time. */
  reason: string | null;
  /** What the Guardrails had to clamp. */
  warnings: string[];
}

export interface SessionPlan {
  exercises: PlannedExercise[];
  /** One line about the whole Session. */
  summary: string;
  source: "rules" | "gemini";
  /** Why this plan is not the one expected (e.g. Gemini unavailable, so rules only). */
  note: string | null;
}

export interface PlanInput {
  /** The day the planned Session is due. */
  date: IsoDate;
  exercises: ExerciseInput[];
  /** Problem Reports and the like: passed to Gemini only. */
  notes?: string[];
}

/** Rules-only Session Plan: what the Rules say, then bounded by the Guardrails. */
export function planSession(rules: Rules, input: PlanInput): SessionPlan {
  const exercises = input.exercises.map((e) => ({ ...planExercise(rules, input.date, e), exerciseId: e.exerciseId }));
  return { exercises, summary: summarize(input.exercises, exercises), source: "rules", note: null };
}

/** What a planner (Gemini or any other) proposes for one Exercise, before the Guardrails. */
export interface RawProposal {
  weight: number | null;
  reps: number;
  sets: number;
  reason: string | null;
}

/** Bounds any proposal by the Guardrails; the reason survives only if the weight really changed. */
export function applyGuardrails(rules: Rules, date: IsoDate, ex: ExerciseInput, p: RawProposal): PlannedExercise {
  const bodyweight = ex.equipment === BODYWEIGHT;
  const base = ex.history.find((h) => logged(h).length > 0);
  const days = base ? diffDays(date, base.date) : 0;
  const pause = base ? rules.special_cases.pause.find((x) => x.max_days === null || days <= x.max_days) : undefined;
  const equipment = rules.increments[ex.equipment] ?? FALLBACK_EQUIPMENT;
  const ctx: Context = {
    lastWeight: base ? workingWeight(base) : null,
    equipment,
    bodyweight,
    goal: ex.goal,
    longPause: !!pause && pause.decrease_pct > rules.guardrails.max_decrease_pct,
    exemptFromIncreaseCap: !!base && base.goal !== ex.goal && rules.special_cases.goal_change.exempt_from_max_increase,
  };
  const weight = p.weight === null || bodyweight ? null : snap(equipment, p.weight, "nearest");
  return { ...finish(rules, ctx, { ...p, weight }), exerciseId: ex.exerciseId };
}

interface Proposal {
  weight: number | null;
  reps: number;
  sets: number;
  reason: string | null;
}

interface Context {
  lastWeight: number | null;
  equipment: EquipmentRules;
  bodyweight: boolean;
  goal: GoalKey;
  /** A long pause may be answered with the larger decrease. */
  longPause: boolean;
  /** A change of Training Goal is not capped on the way up. */
  exemptFromIncreaseCap: boolean;
}

const FALLBACK_EQUIPMENT: EquipmentRules = { min_step: 1 };

const epley = (weight: number, reps: number) => weight * (1 + reps / 30);
const clean = (n: number) => Math.round(n * 1e6) / 1e6;
const kg = (n: number) => `${String(clean(n)).replace(".", ",")} kg`;

function planExercise(rules: Rules, date: IsoDate, ex: ExerciseInput): PlannedExercise {
  const bodyweight = ex.equipment === BODYWEIGHT;
  const equipment = rules.increments[ex.equipment] ?? FALLBACK_EQUIPMENT;
  const [bottom, top] = progressionWindow(rules, ex.goal);

  const base = ex.history.find((h) => logged(h).length > 0);
  const lastWeight = base ? workingWeight(base) : null;
  const ctx: Context = { lastWeight, equipment, bodyweight, goal: ex.goal, longPause: false, exemptFromIncreaseCap: false };

  if (!base) {
    if (ex.start) {
      const weight = bodyweight || ex.start.weight === null ? null : snap(equipment, ex.start.weight, "nearest");
      return finish(rules, ctx, { weight, reps: ex.start.reps, sets: ex.sets, reason: null });
    }
    return finish(rules, ctx, { weight: null, reps: bottom, sets: ex.sets, reason: null });
  }

  const sets = logged(base);
  const lowest = Math.min(...sets.map((s) => s.reps!));

  if (bodyweight) {
    return finish(rules, ctx, { weight: null, reps: lowest + 1, sets: ex.sets, reason: null });
  }

  const w = lastWeight ?? 0;
  const proposal = (weight: number, reps: number, reason: string | null): Proposal => ({ weight, reps, sets: ex.sets, reason });
  const goalRules = rules.goals[ex.goal];

  // A new Training Goal restarts from the Estimated 1RM, with a safety margin.
  if (base.goal !== ex.goal) {
    const gc = rules.special_cases.goal_change;
    const best = Math.max(...sets.map((s) => epley(s.weight ?? 0, s.reps!)));
    const target = (best / (1 + bottom / 30)) * (1 - gc.safety_margin_pct / 100);
    ctx.exemptFromIncreaseCap = gc.exempt_from_max_increase;
    return finish(rules, ctx, proposal(snap(equipment, target, "nearest"), bottom, "Changement d'objectif : charge recalculée depuis l'1RM estimé."));
  }

  // Back after a pause: lighter, and restart from the bottom of the range.
  const days = diffDays(date, base.date);
  const pause = rules.special_cases.pause.find((p) => p.max_days === null || days <= p.max_days)!;
  if (pause.decrease_pct > 0) {
    ctx.longPause = pause.decrease_pct > rules.guardrails.max_decrease_pct;
    return finish(rules, ctx, proposal(snap(equipment, w * (1 - pause.decrease_pct / 100), "nearest"), bottom, `Reprise après ${days} jours de pause : -${pause.decrease_pct} %.`));
  }

  // Failure: any Set under the bottom of the range.
  if (sets.some((s) => s.reps! < bottom)) {
    const f = rules.common.failure;
    let consecutive = 0;
    for (const h of ex.history) {
      const ls = logged(h);
      if (ls.length === 0) continue;
      if (workingWeight(h) !== w || !ls.some((s) => s.reps! < bottom)) break;
      consecutive++;
    }
    if (consecutive >= f.decrease_after_consecutive_failures) {
      return finish(rules, ctx, proposal(snap(equipment, w * (1 - f.decrease_pct / 100), "nearest"), bottom, `Baisse de ${f.decrease_pct} % : ${consecutive} échecs de suite à ${kg(w)}.`));
    }
    return finish(rules, ctx, proposal(w, bottom, null));
  }

  const allAtTop = base.sets.length > 0 && base.sets.every((s) => !s.notCompleted && s.reps !== null && s.reps >= top);
  const overshoot = (() => {
    const first = base.sets[0];
    return !!first && !first.notCompleted && first.reps !== null && first.reps >= top + rules.special_cases.range_overshoot.reps;
  })();
  const braked = goalRules.max_rpe_to_increase !== null && sets.some((s) => s.rpe !== null && s.rpe > goalRules.max_rpe_to_increase!);

  if ((allAtTop || overshoot) && !braked) {
    if (overshoot) {
      const best = epley(base.sets[0].weight ?? 0, base.sets[0].reps!);
      const target = snap(equipment, best / (1 + bottom / 30), "nearest");
      if (target > w) return finish(rules, ctx, proposal(target, bottom, "Charge trop légère : recalculée depuis l'1RM estimé."));
    }
    const target = Math.max(snap(equipment, w * (1 + goalRules.increase_pct / 100), "nearest"), w + equipment.min_step);
    const next = snap(equipment, target, "nearest");
    if (next > w) {
      return finish(rules, ctx, proposal(next, bottom, `Hausse : toutes les séries à ${top} reps.`));
    }
    return finish(rules, ctx, proposal(w, top, null)); // already at the heaviest load there is
  }

  // Everything else: same weight, +1 rep on the weakest Set.
  return finish(rules, ctx, proposal(w, Math.min(top, (allAtTop || overshoot) && braked ? top : lowest + 1), null));
}

/** Applies the Guardrails to a proposal and keeps the reason only when the weight really changed. */
function finish(rules: Rules, ctx: Context, p: Proposal): PlannedExercise {
  const g = rules.guardrails;
  const goal = rules.goals[ctx.goal];
  const warnings: string[] = [];
  let { weight, reps, sets } = p;

  if (weight !== null && ctx.lastWeight !== null) {
    const step = ctx.equipment.min_step;
    if (!ctx.exemptFromIncreaseCap) {
      const ceiling = snap(ctx.equipment, Math.max(clean(ctx.lastWeight * (1 + g.max_increase_pct / 100)), ctx.lastWeight + step), "down");
      if (weight > ceiling) {
        weight = ceiling;
        warnings.push(`Hausse limitée à +${g.max_increase_pct} % (Guardrail).`);
      }
    }
    const maxDecrease = ctx.longPause ? g.max_decrease_pct_after_long_pause : g.max_decrease_pct;
    const floor = snap(ctx.equipment, clean(ctx.lastWeight * (1 - maxDecrease / 100)), "up");
    if (weight < floor) {
      weight = floor;
      warnings.push(`Baisse limitée à -${maxDecrease} % (Guardrail).`);
    }
  }

  if (g.reps_within_goal_range && !ctx.bodyweight) {
    const [lo, hi] = goal.reps_range;
    const clamped = Math.min(hi, Math.max(lo, reps));
    if (clamped !== reps) warnings.push(`Reps ramenées à ${clamped} (fourchette ${lo}-${hi}).`);
    reps = clamped;
  }
  if (g.sets_within_goal_range) {
    const [lo, hi] = goal.sets;
    const clamped = Math.min(hi, Math.max(lo, sets));
    if (clamped !== sets) warnings.push(`Séries ramenées à ${clamped} (fourchette ${lo}-${hi}).`);
    sets = clamped;
  }

  const changed = weight !== null && ctx.lastWeight !== null && clean(weight) !== clean(ctx.lastWeight);
  return { exerciseId: 0, weight: weight === null ? null : clean(weight), reps, sets, reason: changed ? p.reason : null, warnings };
}

function progressionWindow(rules: Rules, goal: GoalKey): [number, number] {
  const g = rules.goals[goal];
  return g.default_progression_window ?? g.reps_range;
}

function logged(h: PastSession): (LoggedSet & { reps: number })[] {
  return h.sets.filter((s): s is LoggedSet & { reps: number } => !s.notCompleted && s.reps !== null);
}

/** The heaviest weight lifted in the Session. */
function workingWeight(h: PastSession): number | null {
  const weights = logged(h).map((s) => s.weight).filter((w): w is number => w !== null);
  return weights.length ? Math.max(...weights) : null;
}

/** Puts a weight on what the equipment can actually load. */
function snap(eq: EquipmentRules, weight: number, mode: "nearest" | "up" | "down"): number {
  const base = eq.bar_weight ?? 0;
  const steps = clean((weight - base) / eq.min_step);
  const n = mode === "up" ? Math.ceil(steps) : mode === "down" ? Math.floor(steps) : Math.round(steps);
  let result = clean(base + n * eq.min_step);
  if (eq.max_load !== undefined) result = Math.min(result, eq.max_load);
  return Math.max(result, eq.min_load ?? base);
}

function summarize(inputs: ExerciseInput[], planned: PlannedExercise[]): string {
  let up = 0;
  let down = 0;
  planned.forEach((p, i) => {
    const h = inputs[i].history.find((s) => logged(s).length > 0);
    const before = h ? workingWeight(h) : null;
    if (p.weight === null || before === null) return;
    if (p.weight > before) up++;
    else if (p.weight < before) down++;
  });
  const n = planned.length;
  const parts = [`${n} exercice${n > 1 ? "s" : ""}`];
  if (up) parts.push(`${up} en hausse`);
  if (down) parts.push(`${down} en baisse`);
  if (!up && !down) parts.push("charges maintenues");
  return parts.join(" · ");
}
