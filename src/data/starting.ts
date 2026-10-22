import { addDays, IsoDate } from "../domain/dates";
import { askForLoads, Generate, LoadRequest, ProposedLoad } from "../planner/gemini";
import { GoalKey, hasNoLoad, Rules } from "../rules/rules";
import { Db, first } from "./db";
import type { Logbook } from "./logbook";
import type { Repo } from "./repo";

/** An Exercise of the Program that has never been done (validated). */
export interface NewExercise {
  exerciseId: number;
  name: string;
  goal: GoalKey;
  equipment: string;
  sets: number;
  /** Position in the first Session of the Program that has it. */
  position: number;
  sessionSize: number;
  sessionName: string;
  /** Its Initial Weight or approved Starting Estimate, if any. */
  start: { weight: number | null; reps: number } | null;
}

export interface StartingEntry {
  exerciseId: number;
  /** null: bodyweight. */
  weight: number | null;
  reps: number;
}

export interface Estimate extends StartingEntry {
  name: string;
  goal: GoalKey;
  /** Why Gemini proposed it. */
  why: string;
}

/** Where a new Program starts: Initial Weights, Starting Estimates and the Test Session. */
export class Starting {
  constructor(
    private db: Db,
    private rules: Rules,
    private repo: Repo,
    private logbook: Logbook,
    private gemini: () => Promise<Generate | null>,
  ) {}

  /** Exercises of the Program with no validated history, in Program order. */
  async exercisesWithoutHistory(programId: number): Promise<NewExercise[]> {
    const rows = await this.db.all<{ exercise_id: number; session_name: string; session_exercises: number }>(
      `SELECT se.exercise_id, ps.name AS session_name,
              (SELECT COUNT(*) FROM session_exercise x WHERE x.program_session_id = ps.id) AS session_exercises
         FROM session_exercise se JOIN program_session ps ON ps.id = se.program_session_id
        WHERE ps.program_id = ? AND ps.test_date IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM set_log s JOIN session_log sl ON sl.id = s.session_log_id
             WHERE s.exercise_id = se.exercise_id AND sl.status = 'validated' AND s.reps IS NOT NULL)
        ORDER BY ps.slot, ps.id, se.position`,
      [programId],
    );
    const result: NewExercise[] = [];
    for (const r of rows) {
      if (result.some((x) => x.exerciseId === r.exercise_id)) continue;
      const se = (await this.sessionExerciseOf(programId, r.exercise_id))!;
      const start = (await first<{ weight: number | null; reps: number }>(this.db, "SELECT weight, reps FROM starting_weight WHERE exercise_id = ?", [r.exercise_id])) ?? null;
      result.push({
        exerciseId: r.exercise_id,
        name: se.name,
        goal: se.goal,
        equipment: se.equipment,
        sets: se.sets,
        position: se.position,
        sessionSize: r.session_exercises,
        sessionName: r.session_name,
        start,
      });
    }
    return result;
  }

  /** Initial Weights typed by hand, or approved Starting Estimates. The Sessions that have them are re-planned from them. */
  async setStartingWeights(entries: StartingEntry[], origin: "manual" | "estimate", today: IsoDate): Promise<void> {
    for (const e of entries) {
      const ex = await first<{ equipment: string }>(this.db, "SELECT equipment FROM exercise WHERE id = ?", [e.exerciseId]);
      if (!ex) throw new Error("Exercice introuvable.");
      if (!Number.isInteger(e.reps) || e.reps < 1) throw new Error("Les reps doivent être un entier d'au moins 1.");
      const bodyweight = hasNoLoad(ex.equipment);
      if (!bodyweight && (e.weight === null || !Number.isFinite(e.weight) || e.weight < 0)) throw new Error("Indique la charge.");
    }
    for (const e of entries) {
      await this.db.run(
        `INSERT INTO starting_weight (exercise_id, weight, reps, origin) VALUES (?, ?, ?, ?)
         ON CONFLICT (exercise_id) DO UPDATE SET weight = excluded.weight, reps = excluded.reps, origin = excluded.origin`,
        [e.exerciseId, e.weight, e.reps, origin],
      );
    }
    const sessions = await this.db.all<{ id: number }>(
      `SELECT DISTINCT ps.id FROM program_session ps JOIN session_exercise se ON se.program_session_id = ps.id
        WHERE ps.test_date IS NULL AND se.exercise_id IN (${entries.map(() => "?").join(",") || "NULL"})`,
      entries.map((e) => e.exerciseId),
    );
    for (const s of sessions) await this.logbook.planSessionOn(s.id, await this.nextDate(s.id, today), false);
  }

  /** Gemini's Starting Estimates for the Exercises with no history. Nothing is saved: the athlete approves or edits them. */
  async proposeEstimates(programId: number): Promise<Estimate[]> {
    const fresh = await this.exercisesWithoutHistory(programId);
    if (fresh.length === 0) throw new Error("Tous les exercices ont déjà un historique.");
    const generate = await this.gemini();
    const requests = await this.requests(fresh);
    const loads = await askForLoads(this.rules, "estimate", requests, generate);
    return loads.map((l, i) => ({ exerciseId: l.exerciseId, name: fresh[i].name, goal: fresh[i].goal, weight: l.weight, reps: l.reps, why: l.why }));
  }

  /** A one-off Session on `date`, planned by Gemini, to measure the athlete's level on the new Exercises. */
  async createTestSession(programId: number, date: IsoDate): Promise<{ sessionId: number; date: IsoDate }> {
    const fresh = await this.exercisesWithoutHistory(programId);
    if (fresh.length === 0) throw new Error("Tous les exercices ont déjà un historique.");
    // In the Test Session they are done together, so the position that matters is the one there.
    const inTest = fresh.map((e, i) => ({ ...e, position: i + 1, sessionSize: fresh.length }));
    const loads = await askForLoads(this.rules, "test", await this.requests(inTest), await this.gemini());

    const session = await this.db.run("INSERT INTO program_session (program_id, name, slot, test_date) VALUES (?, 'Séance test', 0, ?)", [programId, date]);
    const sessionId = session.lastInsertRowId;
    for (const [i, l] of loads.entries()) {
      await this.db.run("INSERT INTO session_exercise (program_session_id, exercise_id, position, sets, goal) VALUES (?, ?, ?, ?, ?)", [
        sessionId,
        l.exerciseId,
        i + 1,
        l.sets,
        fresh[i].goal,
      ]);
    }
    const n = loads.length;
    await this.logbook.storePlan(sessionId, date, {
      exercises: loads.map((l) => ({ exerciseId: l.exerciseId, weight: l.weight, reps: l.reps, sets: l.sets, reason: null, warnings: [] })),
      summary: `Séance test · ${n} exercice${n > 1 ? "s" : ""} à mesurer`,
      source: "gemini",
      note: null,
    });
    return { sessionId, date };
  }

  private async requests(list: NewExercise[]): Promise<LoadRequest[]> {
    const related = await this.relatedHistories(list.map((e) => e.exerciseId));
    return list.map((e) => ({
      exerciseId: e.exerciseId,
      name: e.name,
      goal: e.goal,
      equipment: e.equipment,
      position: e.position,
      sessionSize: e.sessionSize,
      sets: e.sets,
      related,
    }));
  }

  /** Exercises with validated history (most recent first), to derive the new ones from. */
  private async relatedHistories(excluded: number[]): Promise<LoadRequest["related"]> {
    const rows = await this.db.all<{ exercise_id: number; name: string; equipment: string }>(
      `SELECT s.exercise_id, e.name, e.equipment FROM set_log s
         JOIN session_log sl ON sl.id = s.session_log_id JOIN exercise e ON e.id = s.exercise_id
        WHERE sl.status = 'validated' AND s.reps IS NOT NULL
        GROUP BY s.exercise_id ORDER BY MAX(sl.date) DESC LIMIT 12`,
    );
    const out: LoadRequest["related"] = [];
    for (const r of rows) {
      if (excluded.includes(r.exercise_id)) continue;
      out.push({ name: r.name, equipment: r.equipment, history: await this.logbook.history(r.exercise_id, 3) });
    }
    return out;
  }

  private async sessionExerciseOf(programId: number, exerciseId: number) {
    const sessions = await this.db.all<{ id: number }>("SELECT id FROM program_session WHERE program_id = ? AND test_date IS NULL ORDER BY slot, id", [programId]);
    for (const s of sessions) {
      const found = (await this.repo.getSessionExercises(s.id)).find((e) => e.exerciseId === exerciseId);
      if (found) return found;
    }
    return undefined;
  }

  /** The next day the Program Session is planned, else today. */
  private async nextDate(programSessionId: number, today: IsoDate): Promise<IsoDate> {
    for (const day of await this.repo.getCalendar(today, addDays(today, 60), today)) {
      if (day.items.some((i) => i.type === "planned" && i.sessionId === programSessionId && i.status === "planned")) return day.date;
    }
    return today;
  }
}
