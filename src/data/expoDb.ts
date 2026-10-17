import * as SQLite from "expo-sqlite";
import { Db, SqlValue } from "./db";
import { migrate } from "./schema";

/** Opens the on-device database and creates or upgrades its tables on first launch. */
export async function openDatabase(): Promise<Db> {
  const sqlite = await SQLite.openDatabaseAsync("coaching.db");
  const db: Db = {
    exec: (sql) => sqlite.execAsync(sql),
    async run(sql, params = []) {
      const r = await sqlite.runAsync(sql, params);
      return { lastInsertRowId: r.lastInsertRowId };
    },
    all: <T,>(sql: string, params: SqlValue[] = []) => sqlite.getAllAsync<T>(sql, params),
  };
  await migrate(db);
  return db;
}
