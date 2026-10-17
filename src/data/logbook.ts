import { addDays, IsoDate } from "../domain/dates";
import { Generate, planWithGemini } from "../planner/gemini";
import { ExerciseInput, PastSession, SessionPlan, planSession } from "../planner/planner";
import { BODYWEIGHT, GoalKey, Rules } from "../rules/rules";
import { Db, first } from "./db";
import type { Repo } from "./repo";

export interface NumbersLogged {
  weight: number | null;
  reps: number;
  rpe: number;
}

export interface SetLogDetail {
  id: number;
  index: number;
  plannedWeight: number | null;
  plannedReps: number | null;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  notCompleted: boolean;
  /** What this Set was the last time the Exercise was validated. */
  last: NumbersLogged | null;
}

export interface ExerciseLogDetail {
  exerciseId: number;
  name: string;
  position: number;
  goal: GoalKey;
  equipment: string;
  /** Every Set of the Exercise is Not Completed. */
  notCompleted: boolean;
  sets: SetLogDetail[];
}

export interface SessionLogDetail {
  id: number;
  programSessionId: number | null;
  name: string;
  date: IsoDate;
  status: "open" | "validated";
  exercises: ExerciseLogDetail[];
  /** Sets neither logged nor Not Completed: Validation is blocked while this is above 0. */
  remaining: number;
}

export interface StoredPlan {
  sessionId: number;
  /** The day the planned Session is due. */
  date: IsoDate;
  summary: string;
  source: SessionPlan["source"];
  /** Set when the plan is not the one expected, e.g. Gemini was unavailable so the Rules alone planned it. */
  note: string | null;
  exercises: {
    exerciseId: number;
    name: string;
    weight: number | null;
    reps: number;
    sets: number;
    reason: string | null;
    warnings: string[];
  }[];
}

interface SetRow {
  id: number;
  session_log_id: number;
  exercise_id: number;
  name: string;
  equipment: string;
  position: number;
  goal: GoalKey;
  set_index: number;
  planned_weight: number | null;
  planned_reps: number | null;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  not_completed: number;
}

const SET_SELECT = `SELECT s.*, e.name, e.equipment FROM set_log s JOIN exercise e ON e.id = s.exercise_id`;

/** Session logging, Validation, and the planning of the next Session that Validation triggers. */
export class Logbook {
  constructor(
    private db: Db,
    private rules: Rules,
    private repo: Repo,
    /** The Gemini call to plan with, or null when there is no key. Asked at each planning. */
    private gemini: () => Promise<Generate | null> = async () => null,
  ) {}

  /** Opens the log for a Program Session on a date (or returns the one already open), pre-filled from its Session Plan. */
  async startSession(programSessionId: number, date: IsoDate): Promise<number> {
    const existing = await first<{ id: number }>(this.db, "SELECT id FROM session_log WHERE program_session_id = ? AND date = ?", [
      programSessionId,
      date,
    ]);
    if (existing) return existing.id;

    const session = await first<{ name: string }>(this.db, "SELECT name FROM program_session WHERE id = ?", [programSessionId]);
    if (!session) throw new Error("Séance introuvable.");
    const plan = await this.getPlan(programSessionId);
    const exercises = await this.repo.getSessionExercises(programSessionId);

    const log = await this.db.run("INSERT INTO session_log (program_session_id, name, date) VALUES (?, ?, ?)", [programSessionId, session.name, date]);
    for (const e of exercises) {
      const planned = plan?.exercises.find((p) => p.exerciseId === e.exerciseId);
      const sets = planned?.sets ?? e.sets;
      for (let i = 0; i < sets; i++) {
        await this.db.run(
          `INSERT INTO set_log (session_log_id, exercise_id, position, goal, set_index, planned_weight, planned_reps)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [log.lastInsertRowId, e.exerciseId, e.position, e.goal, i, planned?.weight ?? null, planned?.reps ?? null],
        );
      }
    }
    return log.lastInsertRowId;
  }

  async getSessionLog(logId: number): Promise<SessionLogDetail> {
    const log = await first<{ id: number; program_session_id: number | null; name: string; date: IsoDate; status: "open" | "validated" }>(
      this.db,
      "SELECT * FROM session_log WHERE id = ?",
      [logId],
    );
    if (!log) throw new Error("Séance introuvable.");
    const rows = await this.db.all<SetRow>(`${SET_SELECT} WHERE s.session_log_id = ? ORDER BY s.position, s.set_index`, [logId]);

    const exercises: ExerciseLogDetail[] = [];
    for (const r of rows) {
      let ex = exercises.find((e) => e.exerciseId === r.exercise_id);
      if (!ex) {
        ex = { exerciseId: r.exercise_id, name: r.name, position: r.position, goal: r.goal, equipment: r.equipment, notCompleted: false, sets: [] };
        exercises.push(ex);
      }
      ex.sets.push({
        id: r.id,
        index: r.set_index,
        plannedWeight: r.planned_weight,
        plannedReps: r.planned_reps,
        weight: r.weight,
        reps: r.reps,
        rpe: r.rpe,
        notCompleted: !!r.not_completed,
        last: null,
      });
    }
    for (const ex of exercises) {
      ex.notCompleted = ex.sets.every((s) => s.notCompleted);
      const last = await this.lastNumbers(ex.exerciseId, logId, log.date);
      for (const s of ex.sets) s.last = last.get(s.index) ?? null;
    }
    const remaining = exercises.reduce((n, e) => n + e.sets.filter((s) => !s.notCompleted && s.reps === null).length, 0);
    return { id: log.id, programSessionId: log.program_session_id, name: log.name, date: log.date, status: log.status, exercises, remaining };
  }

  async logSet(setId: number, n: { weight: number | null; reps: number; rpe: number }): Promise<void> {
    const row = await this.openSet(setId);
    if (!Number.isInteger(n.reps) || n.reps < 1) throw new Error("Les reps doivent être un entier d'au moins 1.");
    if (!(n.rpe >= 1 && n.rpe <= 10) || n.rpe * 2 !== Math.round(n.rpe * 2)) throw new Error("Le RPE va de 1 à 10, par demi-point.");
    if (row.equipment !== BODYWEIGHT && (n.weight === null || !Number.isFinite(n.weight) || n.weight < 0)) {
      throw new Error("Indique la charge.");
    }
    await this.db.run("UPDATE set_log SET weight = ?, reps = ?, rpe = ?, not_completed = 0 WHERE id = ?", [n.weight, n.reps, n.rpe, setId]);
  }

  /** Marks a Set Not Completed (forgetting its numbers), or puts it back to be logged. */
  async setSetNotCompleted(setId: number, notCompleted: boolean): Promise<void> {
    await this.openSet(setId);
    await this.db.run("UPDATE set_log SET not_completed = ?, weight = NULL, reps = NULL, rpe = NULL WHERE id = ?", [notCompleted ? 1 : 0, setId]);
  }

  async setExerciseNotCompleted(logId: number, exerciseId: number, notCompleted: boolean): Promise<void> {
    await this.assertOpen(logId);
    await this.db.run("UPDATE set_log SET not_completed = ?, weight = NULL, reps = NULL, rpe = NULL WHERE session_log_id = ? AND exercise_id = ?", [
      notCompleted ? 1 : 0,
      logId,
      exerciseId,
    ]);
  }

  /** Closes a finished Session for good, then plans the next one. */
  async validateSession(logId: number, today: IsoDate): Promise<{ plan: StoredPlan | null }> {
    const log = await this.getSessionLog(logId);
    if (log.status === "validated") throw new Error("Cette séance est déjà validée.");
    if (log.remaining > 0) {
      throw new Error(
        `Il reste ${log.remaining} ${log.remaining === 1 ? "série" : "séries"} à saisir ou à marquer comme non faite${log.remaining === 1 ? "" : "s"}.`,
      );
    }
    await this.db.run("UPDATE session_log SET status = 'validated', validated_at = ? WHERE id = ?", [new Date().toISOString(), logId]);
    if (log.programSessionId !== null) await this.db.run("DELETE FROM session_plan WHERE program_session_id = ?", [log.programSessionId]);
    return { plan: await this.planNext(log.date, today) };
  }

  async getPlan(programSessionId: number): Promise<StoredPlan | null> {
    const head = await first<{ date: IsoDate; summary: string; source: StoredPlan["source"]; note: string | null }>(
      this.db,
      "SELECT date, summary, source, note FROM session_plan WHERE program_session_id = ?",
      [programSessionId],
    );
    if (!head) return null;
    const rows = await this.db.all<{ exercise_id: number; name: string; weight: number | null; reps: number; sets: number; reason: string | null; warnings: string }>(
      `SELECT p.*, e.name FROM plan_exercise p JOIN exercise e ON e.id = p.exercise_id
        JOIN session_exercise se ON se.exercise_id = p.exercise_id AND se.program_session_id = p.program_session_id
        WHERE p.program_session_id = ? ORDER BY se.position`,
      [programSessionId],
    );
    return {
      sessionId: programSessionId,
      date: head.date,
      summary: head.summary,
      source: head.source,
      note: head.note,
      exercises: rows.map((r) => ({
        exerciseId: r.exercise_id,
        name: r.name,
        weight: r.weight,
        reps: r.reps,
        sets: r.sets,
        reason: r.reason,
        warnings: JSON.parse(r.warnings) as string[],
      })),
    };
  }

  // --- planning ---

  private async planNext(after: IsoDate, today: IsoDate): Promise<StoredPlan | null> {
    const days = await this.repo.getCalendar(addDays(after, 1), addDays(after, 60), today);
    for (const day of days) {
      for (const item of day.items) {
        if (item.type === "planned" && item.status === "planned") return this.planSessionOn(item.sessionId, day.date);
      }
    }
    return null;
  }

  /** Plans a Program Session due on a date and stores the plan. `withGemini` false: the Rules alone. */
  async planSessionOn(programSessionId: number, date: IsoDate, withGemini = true): Promise<StoredPlan | null> {
    const exercises = await this.repo.getSessionExercises(programSessionId);
    if (exercises.length === 0) return null;
    const inputs: ExerciseInput[] = [];
    for (const e of exercises) {
      const start = await first<{ weight: number | null; reps: number }>(this.db, "SELECT weight, reps FROM starting_weight WHERE exercise_id = ?", [e.exerciseId]);
      inputs.push({
        exerciseId: e.exerciseId,
        name: e.name,
        position: e.position,
        sets: e.sets,
        goal: e.goal,
        equipment: e.equipment,
        history: await this.history(e.exerciseId, 6),
        start,
      });
    }
    const input = { date, exercises: inputs };
    const plan = withGemini ? await planWithGemini(this.rules, input, await this.gemini()) : planSession(this.rules, input);
    return this.storePlan(programSessionId, date, plan);
  }

  /** Replaces the stored Session Plan of a Program Session. */
  async storePlan(programSessionId: number, date: IsoDate, plan: SessionPlan): Promise<StoredPlan | null> {
    await this.db.run("DELETE FROM session_plan WHERE program_session_id = ?", [programSessionId]);
    await this.db.run("INSERT INTO session_plan (program_session_id, date, summary, source, note) VALUES (?, ?, ?, ?, ?)", [
      programSessionId,
      date,
      plan.summary,
      plan.source,
      plan.note,
    ]);
    for (const p of plan.exercises) {
      await this.db.run(
        "INSERT INTO plan_exercise (program_session_id, exercise_id, weight, reps, sets, reason, warnings) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [programSessionId, p.exerciseId, p.weight, p.reps, p.sets, p.reason, JSON.stringify(p.warnings)],
      );
    }
    return this.getPlan(programSessionId);
  }

  /** The last validated Sessions of an Exercise, newest first. */
  async history(exerciseId: number, limit: number): Promise<PastSession[]> {
    const logs = await this.db.all<{ id: number; date: IsoDate }>(
      `SELECT DISTINCT sl.id, sl.date FROM set_log s JOIN session_log sl ON sl.id = s.session_log_id
        WHERE s.exercise_id = ? AND sl.status = 'validated' ORDER BY sl.date DESC, sl.id DESC LIMIT ?`,
      [exerciseId, limit],
    );
    const sessions: PastSession[] = [];
    for (const l of logs) {
      const sets = await this.db.all<{ goal: GoalKey; weight: number | null; reps: number | null; rpe: number | null; not_completed: number }>(
        "SELECT goal, weight, reps, rpe, not_completed FROM set_log WHERE session_log_id = ? AND exercise_id = ? ORDER BY set_index",
        [l.id, exerciseId],
      );
      sessions.push({
        date: l.date,
        goal: sets[0].goal,
        sets: sets.map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.rpe, notCompleted: !!s.not_completed })),
      });
    }
    return sessions;
  }

  private async lastNumbers(exerciseId: number, excludeLogId: number, onOrBefore: IsoDate): Promise<Map<number, NumbersLogged>> {
    const last = await first<{ id: number }>(
      this.db,
      `SELECT sl.id FROM set_log s JOIN session_log sl ON sl.id = s.session_log_id
        WHERE s.exercise_id = ? AND sl.status = 'validated' AND sl.id != ? AND sl.date <= ?
        ORDER BY sl.date DESC, sl.id DESC LIMIT 1`,
      [exerciseId, excludeLogId, onOrBefore],
    );
    const result = new Map<number, NumbersLogged>();
    if (!last) return result;
    const sets = await this.db.all<{ set_index: number; weight: number | null; reps: number | null; rpe: number | null }>(
      "SELECT set_index, weight, reps, rpe FROM set_log WHERE session_log_id = ? AND exercise_id = ? AND not_completed = 0 AND reps IS NOT NULL",
      [last.id, exerciseId],
    );
    for (const s of sets) result.set(s.set_index, { weight: s.weight, reps: s.reps!, rpe: s.rpe! });
    return result;
  }

  // --- frozen history ---

  private async assertOpen(logId: number): Promise<void> {
    const log = await first<{ status: string }>(this.db, "SELECT status FROM session_log WHERE id = ?", [logId]);
    if (!log) throw new Error("Séance introuvable.");
    if (log.status === "validated") throw new Error("Cette séance est validée : elle ne peut plus être modifiée.");
  }

  private async openSet(setId: number): Promise<SetRow> {
    const row = await first<SetRow>(this.db, `${SET_SELECT} WHERE s.id = ?`, [setId]);
    if (!row) throw new Error("Série introuvable.");
    await this.assertOpen(row.session_log_id);
    return row;
  }
}
