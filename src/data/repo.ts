import { CycleKind, datesForSlot, isValidSlot } from "../domain/cycle";
import { IsoDate } from "../domain/dates";
import { addDays } from "../domain/dates";
import { DEFAULT_RULES, Rules } from "../rules/rules";
import { Db, first } from "./db";
import type { Generate } from "../planner/gemini";
import { Logbook } from "./logbook";
import { Starting } from "./starting";

export type { Estimate, NewExercise, StartingEntry } from "./starting";

export type { ExerciseLogDetail, NumbersLogged, SessionLogDetail, SetLogDetail, StoredPlan } from "./logbook";

export type TrainingGoal = "strength" | "endurance" | "hypertrophy";

export interface Program {
  id: number;
  name: string;
  cycle: CycleKind;
  startDate: IsoDate;
}

export interface ProgramSession {
  id: number;
  programId: number;
  name: string;
  slot: number;
}

export interface SessionExercise {
  id: number;
  exerciseId: number;
  name: string;
  position: number;
  sets: number;
  goal: TrainingGoal;
  /** A key of the Rules' increments, or "bodyweight". */
  equipment: string;
}

export interface ProgramDetail {
  program: Program;
  sessions: (ProgramSession & { exercises: SessionExercise[] })[];
}

export type PlannedStatus = "planned" | "done" | "skipped" | "missed" | "moved";

export type CalendarItem =
  | {
      type: "planned";
      sessionId: number;
      name: string;
      status: PlannedStatus;
      /** The date the Session was planned on when it was moved here. */
      movedFrom?: IsoDate;
      /** Set when status is "moved": where it went. */
      movedTo?: IsoDate;
      /** The date the Program planned it on (the key for skip/move/miss actions). */
      plannedDate: IsoDate;
      exerciseCount: number;
      setCount: number;
    }
  | { type: "unplanned" | "rest" | "injury"; id: number; label: string | null };

export interface CalendarDay {
  date: IsoDate;
  items: CalendarItem[];
}

interface ProgramRow {
  id: number;
  name: string;
  cycle: CycleKind;
  start_date: IsoDate;
}

const toProgram = (r: ProgramRow): Program => ({ id: r.id, name: r.name, cycle: r.cycle, startDate: r.start_date });

/** All reads and writes of the Program, its Exercises and the calendar. */
export class Repo {
  private logbook: Logbook;

  private starting: Starting;

  /** `gemini` gives the call to plan with at each planning, or null when there is no key. */
  constructor(
    private db: Db,
    rules: Rules = DEFAULT_RULES,
    gemini: () => Promise<Generate | null> = async () => null,
  ) {
    this.logbook = new Logbook(db, rules, this, gemini);
    this.starting = new Starting(db, rules, this, this.logbook, gemini);
  }

  // --- Where a Program starts: Initial Weights, Starting Estimates, Test Session (see Starting) ---
  exercisesWithoutHistory: Starting["exercisesWithoutHistory"] = (...a) => this.starting.exercisesWithoutHistory(...a);
  setStartingWeights: Starting["setStartingWeights"] = (...a) => this.starting.setStartingWeights(...a);
  proposeEstimates: Starting["proposeEstimates"] = (...a) => this.starting.proposeEstimates(...a);
  createTestSession: Starting["createTestSession"] = (...a) => this.starting.createTestSession(...a);

  // --- Session logging, Validation and planning (see Logbook) ---
  startSession: Logbook["startSession"] = (...a) => this.logbook.startSession(...a);
  getSessionLog: Logbook["getSessionLog"] = (...a) => this.logbook.getSessionLog(...a);
  logSet: Logbook["logSet"] = (...a) => this.logbook.logSet(...a);
  setSetNotCompleted: Logbook["setSetNotCompleted"] = (...a) => this.logbook.setSetNotCompleted(...a);
  setExerciseNotCompleted: Logbook["setExerciseNotCompleted"] = (...a) => this.logbook.setExerciseNotCompleted(...a);
  validateSession: Logbook["validateSession"] = (...a) => this.logbook.validateSession(...a);
  getPlan: Logbook["getPlan"] = (...a) => this.logbook.getPlan(...a);

  async createProgram(p: { name: string; cycle: CycleKind; startDate: IsoDate }): Promise<number> {
    const name = p.name.trim();
    if (!name) throw new Error("Le programme a besoin d'un nom.");
    await this.db.run("UPDATE program SET active = 0");
    const r = await this.db.run("INSERT INTO program (name, cycle, start_date, active) VALUES (?, ?, ?, 1)", [
      name,
      p.cycle,
      p.startDate,
    ]);
    return r.lastInsertRowId;
  }

  async getActiveProgram(): Promise<Program | undefined> {
    const row = await first<ProgramRow>(this.db, "SELECT * FROM program WHERE active = 1 ORDER BY id DESC LIMIT 1");
    return row && toProgram(row);
  }

  async addSession(programId: number, s: { name: string; slot: number }): Promise<number> {
    const program = await first<ProgramRow>(this.db, "SELECT * FROM program WHERE id = ?", [programId]);
    if (!program) throw new Error("Programme introuvable.");
    if (!isValidSlot(program.cycle, s.slot)) throw new Error("Ce jour n'existe pas dans ce cycle.");
    const name = s.name.trim();
    if (!name) throw new Error("La séance a besoin d'un nom.");
    const r = await this.db.run("INSERT INTO program_session (program_id, name, slot) VALUES (?, ?, ?)", [
      programId,
      name,
      s.slot,
    ]);
    return r.lastInsertRowId;
  }

  async removeSession(sessionId: number): Promise<void> {
    await this.db.run("DELETE FROM program_session WHERE id = ?", [sessionId]);
  }

  /** Adds an Exercise to a Session: an existing one by id, or a new one by name. */
  async addExercise(
    sessionId: number,
    e: ({ exerciseId: number } | { name: string; equipment?: string }) & { sets: number; goal: TrainingGoal },
  ): Promise<number> {
    if (!Number.isInteger(e.sets) || e.sets < 1) throw new Error("Il faut au moins une série.");
    let exerciseId: number;
    if ("exerciseId" in e) {
      exerciseId = e.exerciseId;
    } else {
      const name = e.name.trim();
      if (!name) throw new Error("L'exercice a besoin d'un nom.");
      exerciseId = (await this.db.run("INSERT INTO exercise (name, equipment) VALUES (?, ?)", [name, e.equipment ?? "machine"])).lastInsertRowId;
    }
    const last = await first<{ p: number | null }>(
      this.db,
      "SELECT MAX(position) AS p FROM session_exercise WHERE program_session_id = ?",
      [sessionId],
    );
    const r = await this.db.run(
      "INSERT INTO session_exercise (program_session_id, exercise_id, position, sets, goal) VALUES (?, ?, ?, ?, ?)",
      [sessionId, exerciseId, (last?.p ?? 0) + 1, e.sets, e.goal],
    );
    return r.lastInsertRowId;
  }

  async removeExercise(sessionExerciseId: number): Promise<void> {
    await this.db.run("DELETE FROM session_exercise WHERE id = ?", [sessionExerciseId]);
  }

  /** Renames the Exercise everywhere; its id, and so its history, stays the same. */
  async renameExercise(exerciseId: number, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("L'exercice a besoin d'un nom.");
    await this.db.run("UPDATE exercise SET name = ? WHERE id = ?", [trimmed, exerciseId]);
  }

  /** Every Exercise ever created, to pick an existing one rather than duplicate it. */
  async listExercises(): Promise<{ id: number; name: string }[]> {
    return this.db.all("SELECT id, name FROM exercise ORDER BY name COLLATE NOCASE");
  }

  async getSessionExercises(sessionId: number): Promise<SessionExercise[]> {
    const rows = await this.db.all<{
      id: number;
      exercise_id: number;
      name: string;
      position: number;
      sets: number;
      goal: TrainingGoal;
      equipment: string;
    }>(
      `SELECT se.id, se.exercise_id, e.name, e.equipment, se.position, se.sets, se.goal
         FROM session_exercise se JOIN exercise e ON e.id = se.exercise_id
        WHERE se.program_session_id = ? ORDER BY se.position`,
      [sessionId],
    );
    return rows.map((r) => ({
      id: r.id,
      exerciseId: r.exercise_id,
      name: r.name,
      position: r.position,
      sets: r.sets,
      goal: r.goal,
      equipment: r.equipment,
    }));
  }

  async getProgramDetail(programId: number): Promise<ProgramDetail> {
    const row = await first<ProgramRow>(this.db, "SELECT * FROM program WHERE id = ?", [programId]);
    if (!row) throw new Error("Programme introuvable.");
    const sessions = await this.db.all<{ id: number; program_id: number; name: string; slot: number }>(
      "SELECT * FROM program_session WHERE program_id = ? AND test_date IS NULL ORDER BY slot, id",
      [programId],
    );
    return {
      program: toProgram(row),
      sessions: await Promise.all(
        sessions.map(async (s) => ({
          id: s.id,
          programId: s.program_id,
          name: s.name,
          slot: s.slot,
          exercises: await this.getSessionExercises(s.id),
        })),
      ),
    };
  }

  // --- Calendar actions: none of them changes the Program, so nothing shifts. ---

  skipSession(sessionId: number, date: IsoDate) {
    return this.setOccurrence(sessionId, date, "skipped", null);
  }

  markMissed(sessionId: number, date: IsoDate) {
    return this.setOccurrence(sessionId, date, "missed", null);
  }

  async moveSession(sessionId: number, date: IsoDate, to: IsoDate) {
    if (to === date) throw new Error("Choisis un autre jour.");
    return this.setOccurrence(sessionId, date, "moved", to);
  }

  /** Back to the plan for that date. */
  async clearOccurrence(sessionId: number, date: IsoDate): Promise<void> {
    await this.db.run("DELETE FROM occurrence WHERE program_session_id = ? AND date = ?", [sessionId, date]);
  }

  private async setOccurrence(sessionId: number, date: IsoDate, status: string, movedTo: IsoDate | null) {
    await this.db.run(
      `INSERT INTO occurrence (program_session_id, date, status, moved_to) VALUES (?, ?, ?, ?)
       ON CONFLICT (program_session_id, date) DO UPDATE SET status = excluded.status, moved_to = excluded.moved_to`,
      [sessionId, date, status, movedTo],
    );
  }

  async addUnplanned(date: IsoDate, label: string): Promise<number> {
    return this.addEntry(date, "unplanned", label.trim() || "Séance hors programme");
  }

  markRest(date: IsoDate): Promise<number> {
    return this.addEntry(date, "rest", null);
  }

  markInjury(date: IsoDate, label?: string): Promise<number> {
    return this.addEntry(date, "injury", label?.trim() || null);
  }

  private async addEntry(date: IsoDate, kind: string, label: string | null): Promise<number> {
    const r = await this.db.run("INSERT INTO day_entry (date, kind, label) VALUES (?, ?, ?)", [date, kind, label]);
    return r.lastInsertRowId;
  }

  async removeEntry(id: number): Promise<void> {
    await this.db.run("DELETE FROM day_entry WHERE id = ?", [id]);
  }

  /** What the calendar shows from `from` to `to` inclusive. `today` decides what counts as Missed. */
  async getCalendar(from: IsoDate, to: IsoDate, today: IsoDate): Promise<CalendarDay[]> {
    const days = new Map<IsoDate, CalendarItem[]>();
    for (let d = from; d <= to; d = addDays(d, 1)) days.set(d, []);

    const entries = await this.db.all<{ id: number; date: IsoDate; kind: "unplanned" | "rest" | "injury"; label: string | null }>(
      "SELECT * FROM day_entry WHERE date BETWEEN ? AND ? ORDER BY id",
      [from, to],
    );
    const blocked = new Set(entries.filter((e) => e.kind !== "unplanned").map((e) => e.date));

    const program = await this.getActiveProgram();
    if (program) {
      const sessions = await this.db.all<{ id: number; name: string; slot: number; test_date: IsoDate | null; exercises: number; sets: number | null }>(
        `SELECT ps.id, ps.name, ps.slot, ps.test_date, COUNT(se.id) AS exercises, SUM(se.sets) AS sets
           FROM program_session ps LEFT JOIN session_exercise se ON se.program_session_id = ps.id
          WHERE ps.program_id = ? GROUP BY ps.id ORDER BY ps.slot, ps.id`,
        [program.id],
      );
      const occurrences = await this.db.all<{ program_session_id: number; date: IsoDate; status: PlannedStatus; moved_to: IsoDate | null }>(
        `SELECT o.* FROM occurrence o JOIN program_session ps ON ps.id = o.program_session_id
          WHERE ps.program_id = ? AND ((o.date BETWEEN ? AND ?) OR (o.moved_to BETWEEN ? AND ?))`,
        [program.id, from, to, from, to],
      );
      const byKey = new Map(occurrences.map((o) => [`${o.program_session_id}|${o.date}`, o]));
      const done = new Set(
        (
          await this.db.all<{ program_session_id: number; date: IsoDate }>(
            "SELECT program_session_id, date FROM session_log WHERE status = 'validated' AND date BETWEEN ? AND ?",
            [from, to],
          )
        ).map((l) => `${l.program_session_id}|${l.date}`),
      );
      const statusOn = (sessionId: number, date: IsoDate, base: PlannedStatus): PlannedStatus =>
        done.has(`${sessionId}|${date}`) ? "done" : blocked.has(date) ? "skipped" : date < today ? "missed" : base;

      for (const s of sessions) {
        const common = { type: "planned" as const, sessionId: s.id, name: s.name, exerciseCount: s.exercises, setCount: s.sets ?? 0 };
        // A Test Session is one-off: only its own date.
        const dates = s.test_date ? (s.test_date >= from && s.test_date <= to ? [s.test_date] : []) : datesForSlot(program.cycle, program.startDate, s.slot, from, to);
        for (const date of dates) {
          const o = byKey.get(`${s.id}|${date}`);
          const status: PlannedStatus = done.has(`${s.id}|${date}`) ? "done" : o ? o.status : statusOn(s.id, date, "planned");
          days.get(date)!.push({ ...common, status, plannedDate: date, ...(o?.moved_to ? { movedTo: o.moved_to } : {}) });
        }
      }
      // A moved Session also shows on its new day.
      for (const o of occurrences) {
        if (o.status !== "moved" || !o.moved_to || o.moved_to < from || o.moved_to > to) continue;
        const s = sessions.find((x) => x.id === o.program_session_id);
        if (!s) continue;
        days.get(o.moved_to)!.push({
          type: "planned",
          sessionId: s.id,
          name: s.name,
          exerciseCount: s.exercises,
          setCount: s.sets ?? 0,
          status: statusOn(s.id, o.moved_to, "planned"),
          movedFrom: o.date,
          plannedDate: o.date,
        });
      }
    }

    for (const e of entries) days.get(e.date)!.push({ type: e.kind, id: e.id, label: e.label });
    return [...days].map(([date, items]) => ({ date, items }));
  }
}
