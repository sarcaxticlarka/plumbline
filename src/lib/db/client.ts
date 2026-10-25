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
  /* 2: accounts & teams, chain anchors, email outbox/receipts */ `
  ALTER TABLE projects ADD COLUMN owner_email TEXT NOT NULL DEFAULT '';
  ALTER TABLE projects ADD COLUMN owner_name TEXT NOT NULL DEFAULT '';
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE memberships (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (project_id, user_id)
  );
  CREATE TABLE invites (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    invited_by TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (project_id, email)
  );
  CREATE TABLE anchors (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    head_seq INTEGER NOT NULL,
    head_hash TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_anchors_project ON anchors(project_id, head_seq);
  CREATE TABLE emails (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    event_id TEXT,
    kind TEXT NOT NULL,
    to_json TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    body_sha256 TEXT NOT NULL,
    status TEXT NOT NULL,
    provider TEXT NOT NULL,
    message_id TEXT,
    response TEXT,
    sent_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_emails_project ON emails(project_id, created_at);
  `,
];

/**
 * Where the SQLite file lives. On Vercel (and other read-only serverless filesystems) only /tmp is writable, so there
 * the file is forced under /tmp whatever PLUMBLINE_DB says. /tmp is ephemeral: fine for a demo, not for real data.
 */
export const dbPath = () => {
  const configured = process.env.PLUMBLINE_DB || path.join(process.cwd(), "data", "plumbline.db");
  if ((process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) && !path.resolve(configured).startsWith("/tmp/")) return "/tmp/plumbline.db";
  return configured;
};

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
