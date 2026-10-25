import "server-only";
import nodemailer from "nodemailer";

/**
 * One tiny mail abstraction with three honest modes:
 *  • SMTP     — PLUMBLINE_SMTP_URL=smtp://user:pass@host:587      (any provider)
 *  • Resend   — RESEND_API_KEY                                     (HTTP API, supports delivery webhooks)
 *  • preview  — nothing configured: the email is recorded but NOT delivered, and the UI says so.
 */
export type MailMode = "smtp" | "resend" | "preview";

export interface MailInput { to: string[]; cc?: string[]; subject: string; text: string; replyTo?: string }
export interface MailResult {
  status: "sent" | "failed" | "preview";
  provider: MailMode;
  messageId: string | null;
  response: string;
  accepted: string[];
  rejected: string[];
}

export const mailMode = (): MailMode => (process.env.PLUMBLINE_SMTP_URL ? "smtp" : process.env.RESEND_API_KEY ? "resend" : "preview");
const from = () => process.env.PLUMBLINE_FROM || "Plumbline <notices@plumbline.local>";

export async function sendMail(input: MailInput): Promise<MailResult> {
  const mode = mailMode();
  const all = [...input.to, ...(input.cc ?? [])];

  if (mode === "preview") {
    return { status: "preview", provider: mode, messageId: `<preview-${Date.now().toString(36)}@plumbline.local>`, response: "Recorded, not delivered: no email provider is configured.", accepted: [], rejected: [] };
  }

  try {
    if (mode === "smtp") {
      const t = nodemailer.createTransport(process.env.PLUMBLINE_SMTP_URL!);
      const info = await t.sendMail({ from: from(), to: input.to, cc: input.cc, subject: input.subject, text: input.text, replyTo: input.replyTo });
      const accepted = (info.accepted ?? []).map(String);
      const rejected = (info.rejected ?? []).map(String);
      return { status: accepted.length ? "sent" : "failed", provider: mode, messageId: info.messageId ?? null, response: String(info.response ?? ""), accepted, rejected };
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: from(), to: input.to, cc: input.cc, subject: input.subject, text: input.text, reply_to: input.replyTo }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { status: "failed", provider: mode, messageId: null, response: `Resend ${res.status}: ${body.message ?? "error"}`, accepted: [], rejected: all };
    return { status: "sent", provider: mode, messageId: body.id ?? null, response: "Accepted by Resend", accepted: all, rejected: [] };
  } catch (e) {
    return { status: "failed", provider: mode, messageId: null, response: e instanceof Error ? e.message : "Send failed", accepted: [], rejected: all };
  }
}
