import "server-only";
import { notFound, redirect } from "next/navigation";
import { HttpError } from "@/lib/http-error";
import { can, type Action, type Role } from "./permissions";
import { sessionUser } from "./session";
import { roleOf, type User } from "@/lib/db/repo-auth";
import { getProject } from "@/lib/db/repo";
import type { Project } from "@/lib/domain/types";

/** Cross-site writes are refused: browsers send Origin on POST/PATCH/DELETE, and it must match our host. */
export function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, server-to-server) don't send one; they still need the session cookie
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) throw new HttpError(403, "Cross-origin request refused.");
}

/* ----------------------------- route handlers ----------------------------- */

export async function apiUser(req: Request): Promise<User> {
  assertSameOrigin(req);
  const user = await sessionUser();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}

export interface ProjectCtx { user: User; role: Role; project: Project }

/** 401 if signed out, 404 if not a member (don't leak existence), 403 if the role can't do this. */
export async function apiProject(req: Request, projectId: string, action: Action = "project.read"): Promise<ProjectCtx> {
  const user = await apiUser(req);
  const project = getProject(projectId);
  const role = project ? roleOf(projectId, user.id) : null;
  if (!project || !role) throw new HttpError(404, "Project not found.");
  if (!can(role, action)) throw new HttpError(403, "Your role can’t do that on this project.");
  return { user, role, project };
}

/* --------------------------------- pages --------------------------------- */

export async function pageUser(): Promise<User> {
  const user = await sessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function pageProject(projectId: string, action: Action = "project.read"): Promise<ProjectCtx> {
  const user = await pageUser();
  const project = getProject(projectId);
  const role = project ? roleOf(projectId, user.id) : null;
  if (!project || !role) notFound();
  if (!can(role, action)) redirect(`/app/projects/${projectId}`);
  return { user, role, project };
}
