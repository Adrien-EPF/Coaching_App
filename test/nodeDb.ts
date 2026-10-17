import { DatabaseSync } from "node:sqlite";
import { Db, SqlValue } from "../src/data/db";

/** In-memory SQLite (Node built-in) behind the Db interface, for tests. */
export function memoryDb(): Db {
  const sqlite = new DatabaseSync(":memory:");
  return {
    async exec(sql) {
      sqlite.exec(sql);
    },
    async run(sql, params: SqlValue[] = []) {
      const r = sqlite.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return sqlite.prepare(sql).all(...params) as T[];
    },
  };
}
