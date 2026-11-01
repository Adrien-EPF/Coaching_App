import { IsoDate } from "../domain/dates";
import { orderSports } from "../domain/sports";
import { Db, first } from "./db";

export interface CardioInput {
  /** The Program Session this is the occurrence of, or null for an Unplanned Session. */
  programSessionId: number | null;
  date: IsoDate;
  sport: string;
  durationMin: number;
  rpe: number;
  note?: string;
  distanceKm?: number;
  avgHr?: number;
}

export interface CardioLog {
  logId: number;
  programSessionId: number | null;
  date: IsoDate;
  sport: string;
  durationMin: number;
  rpe: number;
  note: string | null;
  distanceKm: number | null;
  avgHr: number | null;
}

/** Cardio Sessions: logged in one go, shown on the calendar, never analysed (no Rules, no Recommendation, no Gemini). */
export class Cardio {
  constructor(private db: Db) {}

  /** Records a cardio Session, validated at once. Logging the same planned occurrence again corrects it. */
  async log(c: CardioInput): Promise<number> {
    const sport = c.sport.trim();
    if (!sport) throw new Error("Indique le sport.");
    if (!(c.durationMin > 0) || !Number.isFinite(c.durationMin)) throw new Error("La durée doit être supérieure à 0.");
    if (!(c.rpe >= 1 && c.rpe <= 10) || c.rpe * 2 !== Math.round(c.rpe * 2)) throw new Error("Le RPE va de 1 à 10, par demi-point.");
    if (c.distanceKm !== undefined && !(c.distanceKm >= 0)) throw new Error("La distance ne peut pas être négative.");
    if (c.avgHr !== undefined && !(Number.isInteger(c.avgHr) && c.avgHr > 0)) throw new Error("La fréquence cardiaque doit être un entier positif.");
    if (c.programSessionId !== null) {
      const s = await first<{ type: string }>(this.db, "SELECT type FROM program_session WHERE id = ?", [c.programSessionId]);
      if (!s) throw new Error("Séance introuvable.");
      if (s.type !== "cardio") throw new Error("Cette séance n'est pas une séance de cardio.");
    }

    const existing =
      c.programSessionId === null
        ? undefined
        : await first<{ id: number }>(this.db, "SELECT id FROM session_log WHERE program_session_id = ? AND date = ?", [c.programSessionId, c.date]);
    let logId: number;
    if (existing) {
      logId = existing.id;
      await this.db.run("UPDATE session_log SET name = ? WHERE id = ?", [sport, logId]);
    } else {
      logId = (
        await this.db.run("INSERT INTO session_log (program_session_id, name, date, status, validated_at, type) VALUES (?, ?, ?, 'validated', ?, 'cardio')", [
          c.programSessionId,
          sport,
          c.date,
          new Date().toISOString(),
        ])
      ).lastInsertRowId;
    }
    await this.db.run(
      "INSERT OR REPLACE INTO cardio_log (session_log_id, sport, duration_min, rpe, note, distance_km, avg_hr) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [logId, sport, c.durationMin, c.rpe, c.note?.trim() || null, c.distanceKm ?? null, c.avgHr ?? null],
    );
    return logId;
  }

  async get(logId: number): Promise<CardioLog> {
    const r = await this.row("WHERE c.session_log_id = ?", [logId]);
    if (!r) throw new Error("Séance de cardio introuvable.");
    return r;
  }

  /** The cardio logged for a planned occurrence, if any. */
  find(programSessionId: number, date: IsoDate): Promise<CardioLog | undefined> {
    return this.row("WHERE sl.program_session_id = ? AND sl.date = ?", [programSessionId, date]);
  }

  async remove(logId: number): Promise<void> {
    await this.db.run("DELETE FROM session_log WHERE id = ? AND type = 'cardio'", [logId]);
  }

  /** Suggested sports, the ones already logged or planned first. */
  async sports(): Promise<string[]> {
    const rows = await this.db.all<{ sport: string }>(
      "SELECT sport FROM cardio_log UNION ALL SELECT sport FROM program_session WHERE type = 'cardio' AND sport IS NOT NULL",
    );
    return orderSports(rows.map((r) => r.sport));
  }

  private async row(where: string, params: (string | number)[]): Promise<CardioLog | undefined> {
    const r = await first<{
      session_log_id: number;
      program_session_id: number | null;
      date: IsoDate;
      sport: string;
      duration_min: number;
      rpe: number;
      note: string | null;
      distance_km: number | null;
      avg_hr: number | null;
    }>(this.db, `SELECT c.*, sl.program_session_id, sl.date FROM cardio_log c JOIN session_log sl ON sl.id = c.session_log_id ${where}`, params);
    return (
      r && {
        logId: r.session_log_id,
        programSessionId: r.program_session_id,
        date: r.date,
        sport: r.sport,
        durationMin: r.duration_min,
        rpe: r.rpe,
        note: r.note,
        distanceKm: r.distance_km,
        avgHr: r.avg_hr,
      }
    );
  }
}
