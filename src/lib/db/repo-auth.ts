import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { db } from "./client";
import type { Role } from "@/lib/auth/permissions";

type Row = Record<string, unknown>;

export interface User { id: string; email: string; name: string }
export interface Member { user: User; role: Role }
export interface Invite { id: string; email: string; role: Role; createdAt: string }

const toUser = (r: Row): User => ({ id: r.id as string, email: r.email as string, name: r.name as string });
export const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/* ---------- users ---------- */
export function createUser(email: string, name: string, passwordHash: string): User {
  const id = randomUUID().slice(0, 8);
  db().prepare("INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)").run(id, email.toLowerCase(), name, passwordHash, new Date().toISOString());
  return { id, email: email.toLowerCase(), name };
}
export function getUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const r = db().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as Row | undefined;
  return r ? { ...toUser(r), passwordHash: r.password_hash as string } : null;
}
export function getUserById(id: string): User | null {
  const r = db().prepare("SELECT * FROM users WHERE id = ?").get(id) as Row | undefined;
  return r ? toUser(r) : null;
}

/* ---------- sessions (only a hash of the token is stored) ---------- */
export function insertSession(token: string, userId: string, days = 30) {
  const now = new Date();
  db().prepare("INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)").run(sha(token), userId, now.toISOString(), new Date(+now + days * 864e5).toISOString());
}
export function userForSession(token: string): User | null {
  const r = db().prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?").get(sha(token), new Date().toISOString()) as Row | undefined;
  return r ? toUser(r) : null;
}
export function deleteSession(token: string) {
  db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
}

/* ---------- membership ---------- */
export function roleOf(projectId: string, userId: string): Role | null {
  const r = db().prepare("SELECT role FROM memberships WHERE project_id = ? AND user_id = ?").get(projectId, userId) as Row | undefined;
  return (r?.role as Role) ?? null;
}
export function projectIdsFor(userId: string): { projectId: string; role: Role }[] {
  return (db().prepare("SELECT project_id, role FROM memberships WHERE user_id = ?").all(userId) as Row[]).map((r) => ({ projectId: r.project_id as string, role: r.role as Role }));
}
export function setMember(projectId: string, userId: string, role: Role) {
  db()
    .prepare("INSERT INTO memberships (project_id,user_id,role,created_at) VALUES (?,?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role = excluded.role")
    .run(projectId, userId, role, new Date().toISOString());
}
export function removeMember(projectId: string, userId: string) {
  db().prepare("DELETE FROM memberships WHERE project_id = ? AND user_id = ?").run(projectId, userId);
}
export function listMembers(projectId: string): Member[] {
  return (db().prepare("SELECT u.*, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.project_id = ? ORDER BY m.created_at").all(projectId) as Row[]).map((r) => ({ user: toUser(r), role: r.role as Role }));
}
export function countPMs(projectId: string): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM memberships WHERE project_id = ? AND role = 'pm'").get(projectId) as { n: number }).n;
}

/* ---------- invites (for people who haven't signed up yet) ---------- */
export function upsertInvite(projectId: string, email: string, role: Role, by: string) {
  db()
    .prepare("INSERT INTO invites (id,project_id,email,role,invited_by,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(project_id,email) DO UPDATE SET role = excluded.role")
    .run(randomUUID().slice(0, 8), projectId, email.toLowerCase(), role, by, new Date().toISOString());
}
export function listInvites(projectId: string): Invite[] {
  return (db().prepare("SELECT * FROM invites WHERE project_id = ? ORDER BY created_at").all(projectId) as Row[]).map((r) => ({ id: r.id as string, email: r.email as string, role: r.role as Role, createdAt: r.created_at as string }));
}
export function deleteInvite(projectId: string, inviteId: string) {
  db().prepare("DELETE FROM invites WHERE project_id = ? AND id = ?").run(projectId, inviteId);
}
/** Called after sign-up / sign-in: any invitation sent to this address becomes a membership. */
export function acceptInvitesFor(user: User) {
  const rows = db().prepare("SELECT * FROM invites WHERE email = ?").all(user.email) as Row[];
  for (const r of rows) {
    setMember(r.project_id as string, user.id, r.role as Role);
    db().prepare("DELETE FROM invites WHERE id = ?").run(r.id as string);
  }
}
