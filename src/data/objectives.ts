import type { IsoDate } from "../domain/dates";
import { isIsoDate } from "../domain/format";
import { Db } from "./db";

export interface NewObjective {
  exerciseId: number;
  reps: number;
  weight: number;
  byDate: IsoDate;
}

export interface Objective extends NewObjective {
  id: number;
  name: string;
  /** Heaviest validated weight at the target reps or more (a heavier set for more reps proves the target), 0 if none. */
  current: number;
  /** current / weight, in whole percent, capped at 100. */
  pct: number;
}

/** Objectives: a target PR with a date, tracked against the logged history. */
export class Objectives {
  constructor(private db: Db) {}

  async add(o: NewObjective): Promise<number> {
    if (!Number.isInteger(o.reps) || o.reps < 1) throw new Error("Les reps doivent être un entier d'au moins 1.");
    if (!Number.isFinite(o.weight) || o.weight <= 0) throw new Error("Indique la charge visée.");
    if (!isIsoDate(o.byDate)) throw new Error("La date doit être au format AAAA-MM-JJ.");
    const r = await this.db.run("INSERT INTO objective (exercise_id, reps, weight, by_date) VALUES (?, ?, ?, ?)", [o.exerciseId, o.reps, o.weight, o.byDate]);
    return r.lastInsertRowId;
  }

  async remove(id: number): Promise<void> {
    await this.db.run("DELETE FROM objective WHERE id = ?", [id]);
  }

  /** All Objectives, soonest date first, with their progress against the current PR. */
  async list(): Promise<Objective[]> {
    const rows = await this.db.all<{ id: number; exercise_id: number; name: string; reps: number; weight: number; by_date: IsoDate; current: number | null }>(
      `SELECT o.id, o.exercise_id, e.name, o.reps, o.weight, o.by_date,
              (SELECT MAX(s.weight) FROM set_log s JOIN session_log sl ON sl.id = s.session_log_id
                WHERE s.exercise_id = o.exercise_id AND sl.status = 'validated' AND s.not_completed = 0 AND s.reps >= o.reps) AS current
         FROM objective o JOIN exercise e ON e.id = o.exercise_id
        ORDER BY o.by_date, o.id`,
    );
    return rows.map((r) => ({
      id: r.id,
      exerciseId: r.exercise_id,
      name: r.name,
      reps: r.reps,
      weight: r.weight,
      byDate: r.by_date,
      current: r.current ?? 0,
      pct: Math.min(100, Math.round(((r.current ?? 0) / r.weight) * 100)),
    }));
  }
}

/** The note Gemini gets for an Objective. */
export const objectiveNote = (o: Objective): string =>
  `Objective: ${o.name} ${o.reps} reps at ${o.weight} kg by ${o.byDate} (now ${o.current} kg). Context only: never override the Guardrails to chase it.`;
