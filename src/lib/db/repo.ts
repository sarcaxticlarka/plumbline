import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, tx } from "./client";
import { GENESIS, computeHash, sha256, verifyChain } from "@/lib/domain/chain";
import { buildEventRecords, type NoticeRow } from "@/lib/domain/events";
import type {
  Attachment, ChainResult, EventRecord, LogEntry, NoticeRules, NoticeStatus, Project, SealedContent,
} from "@/lib/domain/types";

/* ---------- row mappers ---------- */

type Row = Record<string, unknown>;

const toProject = (r: Row): Project => ({
  id: r.id as string,
  name: r.name as string,
  address: r.address as string,
  client: r.client as string,
  contractor: r.contractor as string,
  contractRef: r.contract_ref as string,
  lat: (r.lat as number | null) ?? null,
  lon: (r.lon as number | null) ?? null,
  rules: JSON.parse(r.rules_json as string) as NoticeRules,
  createdAt: r.created_at as string,
});

const toLog = (r: Row): LogEntry => ({
  id: r.id as string,
  projectId: r.project_id as string,
  seq: r.seq as number,
  createdAt: r.created_at as string,
  prevHash: r.prev_hash as string,
  hash: r.hash as string,
  content: JSON.parse(r.content_json as string) as SealedContent,
  score: r.score as number,
});

/* ---------- projects ---------- */

export function listProjects(): Project[] {
  return (db().prepare("SELECT * FROM projects ORDER BY created_at DESC").all() as Row[]).map(toProject);
}

export function getProject(id: string): Project | null {
  const r = db().prepare("SELECT * FROM projects WHERE id = ?").get(id) as Row | undefined;
  return r ? toProject(r) : null;
}

export function insertProject(p: Omit<Project, "id" | "createdAt"> & { id?: string; createdAt?: string }): Project {
  const id = p.id ?? randomUUID().slice(0, 8);
  const createdAt = p.createdAt ?? new Date().toISOString();
  db()
    .prepare(
      "INSERT INTO projects (id,name,address,client,contractor,contract_ref,lat,lon,rules_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
    .run(id, p.name, p.address, p.client, p.contractor, p.contractRef, p.lat, p.lon, JSON.stringify(p.rules), createdAt);
  return getProject(id)!;
}

export const countProjects = (): number => (db().prepare("SELECT COUNT(*) AS n FROM projects").get() as { n: number }).n;

/* ---------- log entries (append-only, hash chained) ---------- */

export function listLogs(projectId: string): LogEntry[] {
  return (db().prepare("SELECT * FROM log_entries WHERE project_id = ? ORDER BY seq ASC").all(projectId) as Row[]).map(toLog);
}

export function getLog(id: string): LogEntry | null {
  const r = db().prepare("SELECT * FROM log_entries WHERE id = ?").get(id) as Row | undefined;
  return r ? toLog(r) : null;
}

export function insertLog(args: { projectId: string; createdAt: string; content: SealedContent; score: number }): LogEntry {
  return tx(() => {
    const last = db()
      .prepare("SELECT seq, hash FROM log_entries WHERE project_id = ? ORDER BY seq DESC LIMIT 1")
      .get(args.projectId) as { seq: number; hash: string } | undefined;
    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.hash ?? GENESIS;
    const hash = computeHash({ seq, projectId: args.projectId, createdAt: args.createdAt, prevHash, content: args.content });
    const id = randomUUID().slice(0, 8);
    db()
      .prepare(
        "INSERT INTO log_entries (id,project_id,seq,created_at,prev_hash,hash,content_json,score) VALUES (?,?,?,?,?,?,?,?)",
      )
      .run(id, args.projectId, seq, args.createdAt, prevHash, hash, JSON.stringify(args.content), args.score);
    return getLog(id)!;
  });
}

export function verifyProjectChain(projectId: string): ChainResult {
  return verifyChain(listLogs(projectId));
}

/* ---------- notices (mutable workflow state, kept outside the seal) ---------- */

export function listNotices(projectId: string): Map<string, NoticeRow> {
  const rows = db().prepare("SELECT event_id, status, sent_on FROM notices WHERE project_id = ?").all(projectId) as Row[];
  return new Map(rows.map((r) => [r.event_id as string, { status: r.status as NoticeStatus, sentOn: (r.sent_on as string | null) ?? null }]));
}

export function upsertNotice(eventId: string, projectId: string, status: NoticeStatus, sentOn: string | null) {
  db()
    .prepare(
      `INSERT INTO notices (event_id, project_id, status, sent_on, updated_at) VALUES (?,?,?,?,?)
       ON CONFLICT(event_id) DO UPDATE SET status = excluded.status, sent_on = excluded.sent_on, updated_at = excluded.updated_at`,
    )
    .run(eventId, projectId, status, sentOn, new Date().toISOString());
}

export function listEvents(projectId: string): EventRecord[] {
  const project = getProject(projectId);
  if (!project) return [];
  return buildEventRecords(project, listLogs(projectId), listNotices(projectId));
}

export function getEvent(eventId: string): { event: EventRecord; log: LogEntry; project: Project } | null {
  const logId = eventId.split(":")[0];
  const log = getLog(logId);
  if (!log) return null;
  const project = getProject(log.projectId);
  if (!project) return null;
  const event = buildEventRecords(project, [log], listNotices(project.id)).find((e) => e.id === eventId);
  return event ? { event, log, project } : null;
}

/* ---------- uploads ---------- */

export const uploadDir = () => path.join(path.dirname(process.env.PLUMBLINE_DB || path.join(process.cwd(), "data", "x")), "uploads");

export function saveUpload(buf: Buffer, name: string, mime: string): Attachment {
  const digest = sha256(buf);
  fs.mkdirSync(uploadDir(), { recursive: true });
  const file = path.join(uploadDir(), digest);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
  db()
    .prepare("INSERT OR IGNORE INTO uploads (sha256,name,mime,size,created_at) VALUES (?,?,?,?,?)")
    .run(digest, name, mime, buf.length, new Date().toISOString());
  return { sha256: digest, name, size: buf.length, mime };
}

export function getUpload(digest: string): { meta: Attachment; data: Buffer } | null {
  const r = db().prepare("SELECT * FROM uploads WHERE sha256 = ?").get(digest) as Row | undefined;
  if (!r) return null;
  const file = path.join(uploadDir(), digest);
  if (!fs.existsSync(file)) return null;
  return { meta: { sha256: digest, name: r.name as string, size: r.size as number, mime: r.mime as string }, data: fs.readFileSync(file) };
}

/* ---------- demo helpers (guarded at the route level by PLUMBLINE_DEMO) ---------- */

/** Edit a sealed entry behind the application's back — exactly what an attacker or a bad actor would do. */
export function tamperWithLog(projectId: string): { seq: number; field: string } | null {
  const logs = listLogs(projectId).filter((l) => l.content.structured.events.some((e) => e.hoursLost !== null));
  const target = logs[Math.min(1, logs.length - 1)] ?? logs[0];
  if (!target) return null;
  const copy = structuredClone(target.content);
  const ev = copy.structured.events.find((e) => e.hoursLost !== null)!;
  ev.hoursLost = Math.max(0.5, (ev.hoursLost ?? 4) - 3);
  db().prepare("UPDATE log_entries SET content_json = ? WHERE id = ?").run(JSON.stringify(copy), target.id);
  return { seq: target.seq, field: "hoursLost" };
}

export function wipeAll() {
  const conn = db();
  conn.exec("DELETE FROM notices; DELETE FROM log_entries; DELETE FROM projects; DELETE FROM uploads;");
}
