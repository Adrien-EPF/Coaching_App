import { Db, first } from "./db";

/** Each entry runs once, in order; the index + 1 is stored in PRAGMA user_version. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE exercise (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );
  CREATE TABLE program (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cycle TEXT NOT NULL CHECK (cycle IN ('week', 'twoWeeks', 'month')),
    start_date TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE program_session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL REFERENCES program(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slot INTEGER NOT NULL
  );
  CREATE TABLE session_exercise (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_session_id INTEGER NOT NULL REFERENCES program_session(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercise(id),
    position INTEGER NOT NULL,
    sets INTEGER NOT NULL CHECK (sets > 0),
    goal TEXT NOT NULL CHECK (goal IN ('strength', 'endurance', 'hypertrophy'))
  );
  -- A planned Session on a given date that was skipped, missed or moved. The Program itself never shifts.
  CREATE TABLE occurrence (
    program_session_id INTEGER NOT NULL REFERENCES program_session(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('skipped', 'missed', 'moved')),
    moved_to TEXT,
    PRIMARY KEY (program_session_id, date)
  );
  -- Things that sit on a day outside the Program: Unplanned Sessions, rest days, injuries.
  CREATE TABLE day_entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('unplanned', 'rest', 'injury')),
    label TEXT
  );
  CREATE INDEX day_entry_date ON day_entry(date);
  `,
  `
  -- The equipment decides which increments the Rules allow; "bodyweight" has no load to progress.
  ALTER TABLE exercise ADD COLUMN equipment TEXT NOT NULL DEFAULT 'machine';

  -- A Session as actually done on a date. Sets snapshot the Program so later edits never rewrite history.
  CREATE TABLE session_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_session_id INTEGER REFERENCES program_session(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'validated')),
    validated_at TEXT
  );
  CREATE UNIQUE INDEX session_log_slot ON session_log(program_session_id, date);
  CREATE TABLE set_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_log_id INTEGER NOT NULL REFERENCES session_log(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercise(id),
    position INTEGER NOT NULL,
    goal TEXT NOT NULL,
    set_index INTEGER NOT NULL,
    planned_weight REAL,
    planned_reps INTEGER,
    weight REAL,
    reps INTEGER,
    rpe REAL,
    not_completed INTEGER NOT NULL DEFAULT 0,
    UNIQUE (session_log_id, exercise_id, set_index)
  );
  CREATE INDEX set_log_exercise ON set_log(exercise_id);

  -- The Session Plan for the next occurrence of a Program Session, replaced at each Validation.
  CREATE TABLE session_plan (
    program_session_id INTEGER PRIMARY KEY REFERENCES program_session(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    summary TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('rules', 'gemini'))
  );
  CREATE TABLE plan_exercise (
    program_session_id INTEGER NOT NULL REFERENCES session_plan(program_session_id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercise(id),
    weight REAL,
    reps INTEGER NOT NULL,
    sets INTEGER NOT NULL,
    reason TEXT,
    warnings TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (program_session_id, exercise_id)
  );
  `,
  `
  -- Why a plan is not the expected one (e.g. Gemini unavailable, so rules only).
  ALTER TABLE session_plan ADD COLUMN note TEXT;

  -- Initial Weights (typed) or approved Starting Estimates: where an Exercise with no history starts.
  CREATE TABLE starting_weight (
    exercise_id INTEGER PRIMARY KEY REFERENCES exercise(id) ON DELETE CASCADE,
    weight REAL,
    reps INTEGER NOT NULL,
    origin TEXT NOT NULL CHECK (origin IN ('manual', 'estimate'))
  );

  -- A one-off Test Session only exists on its date; a normal Program Session repeats on its slot.
  ALTER TABLE program_session ADD COLUMN test_date TEXT;
  `,
  `
  -- A note on an upcoming Session (e.g. bad sleep), sent to Gemini when its plan is regenerated.
  CREATE TABLE problem_report (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_session_id INTEGER NOT NULL REFERENCES program_session(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    kinds TEXT NOT NULL DEFAULT '[]',
    details TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX problem_report_session ON problem_report(program_session_id, date);
  `,
  `
  -- A target PR on an Exercise (reps at a weight) to reach by a date.
  CREATE TABLE objective (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id INTEGER NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
    reps INTEGER NOT NULL CHECK (reps > 0),
    weight REAL NOT NULL CHECK (weight > 0),
    by_date TEXT NOT NULL
  );
  `,
  `
  -- A 1RM estimated by Gemini for an Exercise, from its logged Sets: more precise than a single formula.
  CREATE TABLE one_rm_estimate (
    exercise_id INTEGER PRIMARY KEY REFERENCES exercise(id) ON DELETE CASCADE,
    value REAL NOT NULL CHECK (value > 0),
    why TEXT NOT NULL DEFAULT '',
    estimated_at TEXT NOT NULL
  );
  `,
];

export async function migrate(db: Db): Promise<void> {
  await db.exec("PRAGMA foreign_keys = ON;");
  const row = await first<{ user_version: number }>(db, "PRAGMA user_version");
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.exec(MIGRATIONS[v]);
    await db.exec(`PRAGMA user_version = ${v + 1};`);
  }
}
