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
