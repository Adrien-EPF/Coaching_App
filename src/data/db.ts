/** The small slice of SQLite the app needs. expo-sqlite implements it on the phone, node:sqlite in tests. */
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ lastInsertRowId: number }>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

export type SqlValue = string | number | null;

export async function first<T>(db: Db, sql: string, params?: SqlValue[]): Promise<T | undefined> {
  return (await db.all<T>(sql, params))[0];
}
