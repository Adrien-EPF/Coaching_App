import { applyGuardrails, ExerciseInput, noIncrease, PastSession, PlanInput, planSession, PlannedExercise, SessionPlan } from "./planner";
import { hasNoLoad, Rules } from "../rules/rules";

/** The seam to Gemini: a prompt in, the model's raw text out. Tests plug a fake in here. */
export type Generate = (prompt: string) => Promise<string>;

const NO_KEY = "Pas de clé Gemini : plan calculé avec tes règles seules.";
const unavailable = (why: string) => `Gemini indisponible (${why}) : plan calculé avec tes règles seules.`;

/** One Session Plan from Gemini, bounded by the Guardrails; the rules-only plan, labeled, on any failure or without a key. */
export async function planWithGemini(rules: Rules, input: PlanInput, generate: Generate | null): Promise<SessionPlan> {
  const rulesOnly = (note: string): SessionPlan => ({ ...planSession(rules, input), note });
  if (!generate) return rulesOnly(NO_KEY);
  try {
    const parsed = parsePlan(await generate(planPrompt(rules, input)), input.exercises);
    const exercises = input.exercises.map((e, i) => applyGuardrails(rules, input.date, e, parsed.exercises[i], noIncrease(rules, input)));
    return { exercises, summary: parsed.summary ?? planSession(rules, input).summary, source: "gemini", note: null };
  } catch (e) {
    return rulesOnly(unavailable(e instanceof Error ? e.message : "réponse invalide"));
  }
}

// --- Session Plan ---

function planPrompt(rules: Rules, input: PlanInput): string {
  const exercises = input.exercises.map((e) => ({
    exerciseId: e.exerciseId,
    name: e.name,
    position: e.position,
    sessionSize: input.exercises.length,
    prescribedSets: e.sets,
    trainingGoal: e.goal,
    equipment: e.equipment,
    startingLoad: e.start ? { weight: e.start.weight, reps: e.start.reps } : null,
    estimatedOneRepMax: e.oneRepMax ?? null,
    history: historyFor(e),
  }));
  return [
    "You are the coach of a personal strength-training app. Plan the next Session: for each Exercise, the weight, reps and number of sets.",
    "The only aim is performance (more weight, more reps). Follow the Rules below. Your output is clamped by the Guardrails anyway.",
    "Weights are in kg, on loads the equipment can really make. A bodyweight Exercise has weight null.",
    "A \"timed\" Exercise (plank, holds) has weight null and its `reps` are SECONDS of hold, not repetitions: ignore the reps range of the Training Goal and progress the seconds (see special_cases.timed_hold).",
    "Each Training Goal has its own progression: plan from the history done with the Exercise's current trainingGoal (it is mostly what counts). The history of the other goal is context only; use it only when the Exercise has never been done with the current goal.",
    "An Exercise with an empty history but a `startingLoad` is new to the app: the startingLoad is what the athlete really lifts (their own Initial Weight or an approved estimate). Plan from it, close to that weight, never far below it. Never answer weight 0 for a weighted Exercise.",
    "Give a short `reason` (French) ONLY for an Exercise whose weight differs from its last working weight; otherwise null.",
    "Give one short `summary` line (French) about the whole Session.",
    `Answer with JSON only: {"summary": string, "exercises": [{"exerciseId": number, "weight": number|null, "reps": integer, "sets": integer, "reason": string|null}]}, one entry per Exercise.`,
    `Session due on: ${input.date}`,
    `Rules:\n${JSON.stringify(rulesFor(rules), null, 2)}`,
    ...(noIncrease(rules, input)
      ? ["A Problem Report is attached to this Session: keep or lower the weights, never raise them. Say so in the `reason` of any Exercise you lower."]
      : []),
    "Objectives are context only: they never override the Guardrails or the Rules.",
    `Notes from the athlete (Problem Reports, Objectives):\n${input.notes?.length ? input.notes.map((n) => `- ${n}`).join("\n") : "none"}`,
    `Exercises (history = last Sessions of the Exercise, newest first):\n${JSON.stringify(exercises, null, 2)}`,
  ].join("\n\n");
}

const rulesFor = (rules: Rules) => ({
  common: rules.common,
  special_cases: rules.special_cases,
  guardrails: rules.guardrails,
  goals: rules.goals,
  increments: rules.increments,
  principles: rules.principles,
});

const historyFor = (e: ExerciseInput, limit = 6) =>
  e.history.slice(0, limit).map((h: PastSession) => ({
    date: h.date,
    goal: h.goal,
    sets: h.sets.map((s) => (s.notCompleted ? "not completed" : { weight: s.weight, reps: s.reps, rpe: s.rpe })),
  }));

interface ParsedPlan {
  summary: string | null;
  /** In the same order as the input Exercises. */
  exercises: { weight: number | null; reps: number; sets: number; reason: string | null }[];
}

function parsePlan(text: string, inputs: ExerciseInput[]): ParsedPlan {
  const json = parseJson(text);
  const list = (json as { exercises?: unknown }).exercises;
  if (!Array.isArray(list) || list.length !== inputs.length) throw new Error("exercises");
  const byId = new Map<number, unknown>();
  for (const item of list) byId.set(asRecord(item).exerciseId as number, item);
  const summary = (json as { summary?: unknown }).summary;
  return {
    summary: typeof summary === "string" && summary.trim() ? summary.trim().slice(0, 200) : null,
    exercises: inputs.map((e) => {
      const item = byId.get(e.exerciseId);
      if (!item) throw new Error("missing exercise");
      const r = asRecord(item);
      const reason = typeof r.reason === "string" && r.reason.trim() ? r.reason.trim() : null;
      return { weight: weightOf(r.weight, e.equipment), reps: intOf(r.reps), sets: intOf(r.sets), reason };
    }),
  };
}

// --- Starting Estimates and Test Session ---

export interface LoadRequest {
  exerciseId: number;
  name: string;
  goal: ExerciseInput["goal"];
  equipment: string;
  /** 1-based position in its Session: later Exercises are done tired. */
  position: number;
  sessionSize: number;
  sets: number;
  /** Related movements with history, to derive from. */
  related: { name: string; equipment: string; history: PastSession[] }[];
}

export interface ProposedLoad {
  exerciseId: number;
  /** null: bodyweight. */
  weight: number | null;
  reps: number;
  sets: number;
  why: string;
}

/**
 * Asks Gemini for first loads on Exercises with no history: Starting Estimates for the athlete to approve,
 * or the loads of a Test Session that measures their level. Throws a readable error: it is an explicit action.
 */
export async function askForLoads(rules: Rules, kind: "estimate" | "test", requests: LoadRequest[], generate: Generate | null): Promise<ProposedLoad[]> {
  if (!generate) throw new Error("Ajoute ta clé Gemini dans les réglages pour utiliser cette option.");
  try {
    const list = (parseJson(await generate(loadsPrompt(rules, kind, requests))) as { loads?: unknown }).loads;
    if (!Array.isArray(list)) throw new Error("loads");
    const byId = new Map<number, unknown>();
    for (const item of list) byId.set(asRecord(item).exerciseId as number, item);
    return requests.map((req) => {
      const r = asRecord(byId.get(req.exerciseId));
      // Goes through the same clamp as any plan: no history, so only equipment and Training Goal bound it.
      const exercise: ExerciseInput = { exerciseId: req.exerciseId, name: req.name, position: req.position, sets: req.sets, goal: req.goal, equipment: req.equipment, history: [] };
      const planned: PlannedExercise = applyGuardrails(rules, "2000-01-01", exercise, {
        weight: weightOf(r.weight, req.equipment),
        reps: intOf(r.reps),
        sets: kind === "test" ? intOf(r.sets) : req.sets,
        reason: null,
      });
      const why = typeof r.why === "string" ? r.why.trim() : "";
      return { exerciseId: req.exerciseId, weight: planned.weight, reps: planned.reps, sets: planned.sets, why };
    });
  } catch (e) {
    throw new Error(`Gemini n'a pas donné de réponse exploitable (${e instanceof Error ? e.message : "réponse invalide"}). Réessaie plus tard.`, { cause: e });
  }
}

function loadsPrompt(rules: Rules, kind: "estimate" | "test", requests: LoadRequest[]): string {
  const goal =
    kind === "estimate"
      ? "Propose a Starting Estimate (weight and reps for one working set) for each Exercise below, which has no history. Derive it from the related movements and their history (Estimated 1RM, Epley), and from the equipment's real increments. Be conservative: it is better to start slightly light."
      : "Plan a Test Session that will measure the athlete's level on these new Exercises: for each, give the weight, reps and sets to try, conservative enough to be safe yet informative, derived from the related movements.";
  const items = requests.map((r) => ({
    exerciseId: r.exerciseId,
    name: r.name,
    trainingGoal: r.goal,
    equipment: r.equipment,
    position: r.position,
    sessionSize: r.sessionSize,
    prescribedSets: r.sets,
    related: r.related.map((x) => ({ name: x.name, equipment: x.equipment, history: historyFor({ history: x.history } as ExerciseInput) })),
  }));
  return [
    "You are the coach of a personal strength-training app. The only aim is performance.",
    goal,
    "Take each Exercise's position in its Session into account: an Exercise done later in the Session is done tired, so it takes a lighter load than the same movement done first.",
    "Weights are in kg, on loads the equipment can really make. A bodyweight Exercise has weight null.",
    `Answer with JSON only: {"loads": [{"exerciseId": number, "weight": number|null, "reps": integer, "sets": integer, "why": string}]}, one entry per Exercise. \`why\` is one short sentence in French.`,
    `Rules:\n${JSON.stringify({ goals: rules.goals, increments: rules.increments, principles: rules.principles }, null, 2)}`,
    `Exercises:\n${JSON.stringify(items, null, 2)}`,
  ].join("\n\n");
}

// --- Estimated 1RM ---

export interface OneRmRequest {
  exerciseId: number;
  name: string;
  equipment: string;
  /** Validated working Sets with a load, newest first. For weighted bodyweight movements the weight is the added load. */
  sets: { date: string; weight: number; reps: number; rpe: number | null; goal: string }[];
}

export interface OneRmEstimate {
  exerciseId: number;
  /** kg, on the lifted load only. */
  oneRepMax: number;
  why: string;
}

const heaviest = (r: OneRmRequest) => Math.max(...r.sets.map((s) => s.weight));
const epleyBest = (r: OneRmRequest) => Math.max(...r.sets.map((s) => (s.reps <= 1 ? s.weight : s.weight * (1 + s.reps / 30))));

/**
 * Asks Gemini for the 1RM of each Exercise, from its logged Sets. Throws a readable error: it is an explicit action.
 * The answer is clamped: never under the heaviest weight really lifted, never far above the Epley estimate.
 */
export async function askForOneRepMaxes(requests: OneRmRequest[], generate: Generate | null): Promise<OneRmEstimate[]> {
  if (!generate) throw new Error("Ajoute ta clé Gemini dans les réglages pour utiliser cette option.");
  if (requests.length === 0) return [];
  try {
    const list = (parseJson(await generate(oneRmPrompt(requests))) as { estimates?: unknown }).estimates;
    if (!Array.isArray(list)) throw new Error("estimates");
    const byId = new Map<number, unknown>();
    for (const item of list) byId.set(asRecord(item).exerciseId as number, item);
    return requests.map((req) => {
      const r = asRecord(byId.get(req.exerciseId));
      if (typeof r.oneRepMax !== "number" || !Number.isFinite(r.oneRepMax) || r.oneRepMax <= 0) throw new Error("not a weight");
      const oneRepMax = Math.round(Math.min(epleyBest(req) * 1.3, Math.max(heaviest(req), r.oneRepMax)) * 10) / 10;
      return { exerciseId: req.exerciseId, oneRepMax, why: typeof r.why === "string" ? r.why.trim() : "" };
    });
  } catch (e) {
    throw new Error(`Gemini n'a pas donné de réponse exploitable (${e instanceof Error ? e.message : "réponse invalide"}). Réessaie plus tard.`, { cause: e });
  }
}

function oneRmPrompt(requests: OneRmRequest[]): string {
  const items = requests.map((r) => ({ exerciseId: r.exerciseId, name: r.name, equipment: r.equipment, sets: r.sets.slice(0, 40) }));
  return [
    "You are the coach of a personal strength-training app. Estimate the one-rep max (1RM) of the athlete on each Exercise below, from their logged working Sets.",
    "Pick the estimate that fits the movement: the reliability of a formula depends on the Exercise (compound vs isolation, machine vs free weight) and on the reps (high reps overestimate). Weigh the heaviest, lowest-rep and most recent Sets most, and use the RPE when given (RPE 10 = no rep left, 9 = 1 left, 8 = 2 left).",
    "Weights are in kg and count the lifted load only: for a weighted bodyweight movement (weight belt) it is the added load, never bodyweight.",
    "Never answer below the heaviest weight in the Sets.",
    `Answer with JSON only: {"estimates": [{"exerciseId": number, "oneRepMax": number, "why": string}]}, one entry per Exercise. The \`why\` is one short sentence in French.`,
    `Exercises:\n${JSON.stringify(items, null, 2)}`,
  ].join("\n\n");
}

// --- parsing helpers ---

function parseJson(text: string): Record<string, unknown> {
  const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return asRecord(JSON.parse(body));
}

function asRecord(v: unknown): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error("not an object");
  return v as Record<string, unknown>;
}

function intOf(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) throw new Error("not a positive integer");
  return v;
}

function weightOf(v: unknown, equipment: string): number | null {
  if (hasNoLoad(equipment)) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error("not a weight");
  return v;
}
