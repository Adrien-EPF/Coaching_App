import { Db, first, SqlValue } from "./db";

const APP = "coaching-app";

/** Every table, parents before the tables that reference them. */
const TABLES = [
  "exercise",
  "program",
  "program_session",
  "session_exercise",
  "occurrence",
  "day_entry",
  "session_log",
  "set_log",
  "session_plan",
  "plan_exercise",
  "starting_weight",
  "problem_report",
  "objective",
] as const;

type Row = Record<string, SqlValue>;

const schemaVersion = async (db: Db): Promise<number> => (await first<{ user_version: number }>(db, "PRAGMA user_version"))?.user_version ?? 0;

/** All the data as JSON, full fidelity: ids, validation state and plans included. */
export async function exportJson(db: Db): Promise<string> {
  const tables: Record<string, Row[]> = {};
  for (const t of TABLES) tables[t] = await db.all<Row>(`SELECT * FROM ${t} ORDER BY rowid`);
  return JSON.stringify({ app: APP, schemaVersion: await schemaVersion(db), exportedAt: new Date().toISOString(), tables }, null, 2);
}

/** The logged Sets, one row each, for a spreadsheet. */
export async function exportCsv(db: Db): Promise<string> {
  const header = ["date", "session", "status", "exercise", "goal", "set", "planned_weight", "planned_reps", "weight", "reps", "rpe", "not_completed"];
  const rows = await db.all<Row>(
    `SELECT sl.date, sl.name AS session, sl.status, e.name AS exercise, s.goal, s.set_index + 1 AS "set",
            s.planned_weight, s.planned_reps, s.weight, s.reps, s.rpe, s.not_completed
       FROM set_log s JOIN session_log sl ON sl.id = s.session_log_id JOIN exercise e ON e.id = s.exercise_id
      ORDER BY sl.date, sl.id, s.position, s.set_index`,
  );
  const cell = (v: SqlValue | undefined) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [header.join(","), ...rows.map((r) => header.map((h) => cell(r[h])).join(","))].join("\n") + "\n";
}

/**
 * Replaces everything with an exported JSON, as it was: validated Sessions stay validated, ids stay the same.
 * Checked before anything is touched, and all-or-nothing: on any failure the data is left as it was.
 */
export async function importJson(db: Db, text: string): Promise<void> {
  const tables = parse(text, await schemaVersion(db));
  const columns = new Map<string, Set<string>>();
  for (const t of TABLES) columns.set(t, new Set((await db.all<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name)));

  await db.exec("BEGIN");
  try {
    for (const t of [...TABLES].reverse()) await db.exec(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      for (const row of tables[t]) {
        const keys = Object.keys(row).filter((k) => columns.get(t)!.has(k));
        await db.run(`INSERT INTO ${t} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`, keys.map((k) => row[k]));
      }
    }
    const broken = await db.all("PRAGMA foreign_key_check");
    if (broken.length > 0) throw new Error("Fichier incohérent : des données renvoient à des éléments absents.");
    await db.exec("COMMIT");
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}

function parse(text: string, currentVersion: number): Record<(typeof TABLES)[number], Row[]> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas un export JSON valide.");
  }
  const file = json as { app?: unknown; schemaVersion?: unknown; tables?: Record<string, unknown> };
  if (!file || file.app !== APP || typeof file.schemaVersion !== "number" || typeof file.tables !== "object" || file.tables === null) {
    throw new Error("Ce fichier n'est pas un export de cette application.");
  }
  if (file.schemaVersion > currentVersion) throw new Error("Cet export vient d'une version plus récente de l'application : mets-la à jour avant d'importer (version du fichier trop récente).");
  const out = {} as Record<(typeof TABLES)[number], Row[]>;
  for (const t of TABLES) {
    const rows = file.tables[t] ?? [];
    const valid =
      Array.isArray(rows) &&
      rows.every((r) => typeof r === "object" && r !== null && !Array.isArray(r) && Object.values(r).every((v) => v === null || typeof v === "string" || typeof v === "number"));
    if (!valid) throw new Error(`Export illisible (${t}).`);
    out[t] = rows as Row[];
  }
  return out;
}
