// DB bootstrap (placeholder) — wire better-sqlite3 in implementation
export type SqliteDatabase = unknown;

export function openDatabase(dbPath: string): SqliteDatabase {
  // Example (when wired): const db = new Database(dbPath); applyMigrations(db); return db;
  return {} as any;
}

export function applyMigrations(_db: SqliteDatabase) {
  // Read files under ./migrations in order and run them idempotently
}

