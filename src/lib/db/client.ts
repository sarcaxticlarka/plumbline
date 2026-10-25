import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * SQLite via Node's built-in `node:sqlite` — zero native dependencies, one file on disk.
 * Migrations are versioned through PRAGMA user_version so they are idempotent and ordered.
 */

const MIGRATIONS: string[] = [
  /* 1 */ `
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    client TEXT NOT NULL DEFAULT '',
    contractor TEXT NOT NULL DEFAULT '',
    contract_ref TEXT NOT NULL DEFAULT '',
    lat REAL,
    lon REAL,
    rules_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE log_entries (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL,
    content_json TEXT NOT NULL,
    score INTEGER NOT NULL,
    UNIQUE (project_id, seq)
  );
  CREATE INDEX idx_logs_project ON log_entries(project_id, seq);
  CREATE TABLE notices (
    event_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'open',
    sent_on TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE uploads (
    sha256 TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
];

export const dbPath = () => process.env.PLUMBLINE_DB || path.join(process.cwd(), "data", "plumbline.db");

type G = typeof globalThis & { __plumblineDb?: DatabaseSync };

export function db(): DatabaseSync {
  const g = globalThis as G;
  if (g.__plumblineDb) return g.__plumblineDb;
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new DatabaseSync(file);
  conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 4000;");
  const current = (conn.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    conn.exec("BEGIN");
    try {
      conn.exec(MIGRATIONS[v]);
      conn.exec(`PRAGMA user_version = ${v + 1}`);
      conn.exec("COMMIT");
    } catch (err) {
      conn.exec("ROLLBACK");
      throw err;
    }
  }
  g.__plumblineDb = conn;
  return conn;
}

export function tx<T>(fn: () => T): T {
  const conn = db();
  conn.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    conn.exec("COMMIT");
    return out;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}
