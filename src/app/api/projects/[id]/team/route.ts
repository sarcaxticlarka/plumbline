import { z } from "zod";
import { apiProject } from "@/lib/auth/guards";
import { isRole } from "@/lib/auth/permissions";
import { countPMs, deleteInvite, getUserByEmail, listInvites, listMembers, removeMember, roleOf, setMember, upsertInvite } from "@/lib/db/repo-auth";
import { fail, handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await apiProject(req, id, "project.read");
    return json({ members: listMembers(id), invites: listInvites(id) });
  } catch (e) {
    return handle(e);
  }
}

const Invite = z.object({ email: z.string().trim().email().max(200), role: z.string().refine(isRole, "Unknown role") });

/** Add (or re-role) a person. Existing accounts join immediately; everyone else gets a pending invite that activates when they sign up. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { user } = await apiProject(req, id, "team.manage");
    const { email, role } = Invite.parse(await req.json());
    if (!isRole(role)) return fail("Unknown role", 422);
    const existing = getUserByEmail(email);
    if (existing) {
      if (existing.id === user.id && role !== "pm" && countPMs(id) <= 1) return fail("You’re the only project manager — promote someone else first.", 409);
      setMember(id, existing.id, role);
      return json({ joined: true, members: listMembers(id), invites: listInvites(id) });
    }
    upsertInvite(id, email, role, user.id);
    return json({ joined: false, members: listMembers(id), invites: listInvites(id) });
  } catch (e) {
    return handle(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    await apiProject(req, id, "team.manage");
    const q = new URL(req.url).searchParams;
    const userId = q.get("userId");
    const inviteId = q.get("inviteId");
    if (inviteId) deleteInvite(id, inviteId);
    else if (userId) {
      if (roleOf(id, userId) === "pm" && countPMs(id) <= 1) return fail("A project needs at least one project manager.", 409);
      removeMember(id, userId);
    }
    return json({ members: listMembers(id), invites: listInvites(id) });
  } catch (e) {
    return handle(e);
  }
}
