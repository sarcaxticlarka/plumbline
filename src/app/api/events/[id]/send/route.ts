import { z } from "zod";
import * as repo from "@/lib/db/repo";
import { apiProject } from "@/lib/auth/guards";
import { sendMail, mailMode } from "@/lib/email";
import { todayLocal } from "@/lib/domain/dates";
import { clientIp, fail, handle, json, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  to: z.array(z.string().trim().email()).min(1, "Add at least one recipient").max(5),
  cc: z.array(z.string().trim().email()).max(5).default([]),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(20).max(20_000),
});

/**
 * Email a notice letter from the app and record a receipt. A notice is only marked SENT when a real provider
 * accepted it — in preview mode (no provider configured) nothing is delivered, so nothing is marked sent.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const found = repo.getEvent(decodeURIComponent(id));
    if (!found) return fail("Event not found", 404);
    const { user } = await apiProject(req, found.project.id, "notice.send");
    if (!rateLimit(`mail:${clientIp(req)}:${user.id}`, 10, 60_000)) return fail("Too many emails — wait a minute.", 429);
    const b = Body.parse(await req.json());

    const r = await sendMail({ to: b.to, cc: b.cc, subject: b.subject, text: b.body, replyTo: user.email });
    const email = repo.insertEmail({
      projectId: found.project.id,
      eventId: found.event.id,
      kind: "notice",
      to: [...b.to, ...b.cc],
      subject: b.subject,
      body: b.body,
      status: r.status === "sent" ? "sent" : r.status === "preview" ? "preview" : "failed",
      provider: r.provider,
      messageId: r.messageId,
      response: r.response,
      sentBy: user.id,
    });
    if (r.status === "sent") repo.upsertNotice(found.event.id, found.project.id, "sent", todayLocal());
    return json({ email: { ...email, body: undefined }, delivered: r.status === "sent", mode: mailMode() }, r.status === "failed" ? 502 : 200);
  } catch (e) {
    return handle(e);
  }
}
