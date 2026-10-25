import { timingSafeEqual } from "node:crypto";
import { setEmailStatusByMessageId } from "@/lib/db/repo";
import { fail, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Delivery receipts from Resend: POST https://your-host/api/webhooks/email?token=$PLUMBLINE_WEBHOOK_SECRET
 * Handles email.delivered / email.bounced / email.complained. Disabled unless the secret is set.
 */
export async function POST(req: Request) {
  const secret = process.env.PLUMBLINE_WEBHOOK_SECRET;
  if (!secret) return fail("Not found", 404);
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const a = Buffer.from(token), b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail("Unauthorized", 401);

  const evt = (await req.json().catch(() => null)) as { type?: string; data?: { email_id?: string } } | null;
  const id = evt?.data?.email_id;
  if (!evt?.type || !id) return fail("Bad payload", 400);
  const map: Record<string, "delivered" | "bounced"> = { "email.delivered": "delivered", "email.bounced": "bounced", "email.complained": "bounced" };
  const status = map[evt.type];
  if (!status) return json({ ignored: true });
  return json({ updated: setEmailStatusByMessageId(id, status, evt.type) });
}
