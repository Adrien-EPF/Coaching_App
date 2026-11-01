import type { IsoDate } from "../domain/dates";
import type { ActivitySession, Goal } from "../domain/progressSeries";
import { estimateOneRepMax } from "../domain/records";
import { Db } from "./db";

export interface ExerciseHistory {
  name: string;
  /** Every validated lifted Set, with the Training Goal it was done under. */
  sets: { date: IsoDate; weight: number; reps: number; goal: Goal }[];
  /** The 1RM each Objective of the Exercise stands for (its target reps at its target weight, through the same formula). */
  targets: { id: number; oneRepMax: number; reps: number; weight: number; byDate: IsoDate }[];
}

/** What the progress charts read: the raw history, shaped by the pure functions of domain/progressSeries. */
export class Charts {
  constructor(private db: Db) {}

  async exerciseHistory(exerciseId: number): Promise<ExerciseHistory> {
    const sets = await this.db.all<{ date: IsoDate; weight: number; reps: number; goal: Goal }>(
      `SELECT sl.date, s.weight, s.reps, s.goal
         FROM set_log s JOIN session_log sl ON sl.id = s.session_log_id
        WHERE s.exercise_id = ? AND sl.status = 'validated' AND s.not_completed = 0 AND s.reps IS NOT NULL AND s.weight > 0
        ORDER BY sl.date`,
      [exerciseId],
    );
    const named = await this.db.all<{ name: string }>("SELECT name FROM exercise WHERE id = ?", [exerciseId]);
    const targets = await this.db.all<{ id: number; reps: number; weight: number; by_date: IsoDate }>(
      "SELECT id, reps, weight, by_date FROM objective WHERE exercise_id = ? ORDER BY by_date, id",
      [exerciseId],
    );
    return {
      name: named[0]?.name ?? "",
      sets,
      targets: targets.map((t) => ({ id: t.id, oneRepMax: estimateOneRepMax(t.weight, t.reps), reps: t.reps, weight: t.weight, byDate: t.by_date })),
    };
  }

  /** Every validated Session with its volume (strength) or duration (cardio). */
  activity(): Promise<ActivitySession[]> {
    return this.db.all<ActivitySession>(
      `SELECT sl.date AS date, sl.type AS type,
              COALESCE((SELECT SUM(s.weight * s.reps) FROM set_log s
                         WHERE s.session_log_id = sl.id AND s.not_completed = 0 AND s.reps IS NOT NULL AND s.weight > 0), 0) AS volume,
              (SELECT c.duration_min FROM cardio_log c WHERE c.session_log_id = sl.id) AS durationMin
         FROM session_log sl
        WHERE sl.status = 'validated'
        ORDER BY sl.date`,
    );
  }
}
