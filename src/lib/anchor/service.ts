import "server-only";
import { verifyChain } from "@/lib/domain/chain";
import type { ChainResult } from "@/lib/domain/types";
import { getProject, insertAnchor, insertEmail, listAnchors, listLogs, type AnchorRow } from "@/lib/db/repo";
import { anchorDigest, anchorMessage, buildTimestampRequest, parseTimestampResponse } from "./der";
import { sendMail } from "@/lib/email";
import { formatDate } from "@/lib/domain/dates";

export interface AnchorStatus extends AnchorRow { ok: boolean; reason?: string }
export interface Integrity { chain: ChainResult; anchors: AnchorStatus[]; anchoredOk: boolean }

/**
 * Hash-chain integrity PLUS external anchors. The chain alone can be re-computed end to end by anyone with
 * database write access; an anchor (a hash timestamped by a third party, or emailed to the other side) can't.
 */
export function integrity(projectId: string): Integrity {
  const logs = listLogs(projectId);
  const chain = verifyChain(logs);
  const anchors = listAnchors(projectId)
    .filter((a) => a.status !== "preview") // an email that was never delivered proves nothing
    .map<AnchorStatus>((a) => {
    const e = logs.find((l) => l.seq === a.headSeq);
    if (!e) return { ...a, ok: false, reason: `Entry #${a.headSeq} no longer exists.` };
    if (e.hash !== a.headHash)
      return { ...a, ok: false, reason: `Entry #${a.headSeq} no longer matches the hash that was ${a.kind === "rfc3161" ? "timestamped" : "emailed"} on ${formatDate(a.createdAt.slice(0, 10))} — history was rewritten after that point.` };
    return { ...a, ok: true };
  });
  return { chain, anchors, anchoredOk: anchors.every((a) => a.ok) };
}

const tsaUrls = () => [process.env.PLUMBLINE_TSA_URL || "https://freetsa.org/tsr", "http://timestamp.digicert.com"];

export async function requestTimestamp(projectId: string, seq: number, hash: string) {
  const digest = anchorDigest(projectId, seq, hash);
  const { der, nonce } = buildTimestampRequest(digest);
  const errors: string[] = [];
  for (const url of tsaUrls()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/timestamp-query" },
        body: new Uint8Array(der),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const r = parseTimestampResponse(buf, digest, nonce);
      if (!r.granted) throw new Error(`TSA refused (status ${r.status})`);
      if (!r.digestEchoed) throw new Error("TSA response doesn't contain our digest");
      return { tsa: url, genTime: r.genTime, nonceEchoed: r.nonceEchoed, digestHex: digest.toString("hex"), message: anchorMessage(projectId, seq, hash), tsrBase64: buf.toString("base64") };
    } catch (e) {
      errors.push(`${new URL(url).host}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  throw new Error(`No timestamp authority answered (${errors.join("; ")}).`);
}

export interface AnchorOutcome { created: AnchorRow[]; skipped: string[]; errors: string[] }

export async function anchorProject(projectId: string, opts: { rfc3161?: boolean; email?: boolean; by?: string } = {}): Promise<AnchorOutcome> {
  const out: AnchorOutcome = { created: [], skipped: [], errors: [] };
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found");
  const logs = listLogs(projectId);
  if (!logs.length) return { ...out, errors: ["Nothing to anchor yet — seal a log entry first."] };
  const state = integrity(projectId);
  if (!state.chain.ok || !state.anchoredOk) return { ...out, errors: ["Not anchoring: the record currently fails verification. Anchoring a broken chain would certify the damage."] };

  const head = logs[logs.length - 1];
  const existing = listAnchors(projectId);
  const have = (kind: string) => existing.some((a) => a.kind === kind && a.headSeq === head.seq && a.headHash === head.hash);

  if (opts.rfc3161 !== false) {
    if (have("rfc3161")) out.skipped.push(`Entry #${head.seq} is already timestamped.`);
    else
      try {
        const t = await requestTimestamp(projectId, head.seq, head.hash);
        out.created.push(insertAnchor({ projectId, headSeq: head.seq, headHash: head.hash, kind: "rfc3161", status: "timestamped", detail: { ...t, verify: "openssl ts -verify -in anchor.tsr -digest <digestHex> -CAfile <TSA CA bundle>" } }));
      } catch (e) {
        out.errors.push(e instanceof Error ? e.message : "Timestamp failed");
      }
  }

  if (opts.email !== false && project.ownerEmail) {
    if (have("email")) out.skipped.push(`Entry #${head.seq} head was already emailed.`);
    else {
      const subject = `${project.name} — daily record fingerprint (entry #${head.seq})`;
      const text = [
        `This is an automatic integrity notice for the project daily log: ${project.name}.`,
        "",
        `Sealed entries: ${logs.length}`,
        `Latest entry: #${head.seq} (${head.content.logDate})`,
        `Chain head (SHA-256): ${head.hash}`,
        "",
        "Keep this email. If the daily record is ever challenged, the hash above lets anyone confirm the log was not altered after today.",
        "No log content is included — only the fingerprint.",
      ].join("\n");
      const r = await sendMail({ to: [project.ownerEmail], subject, text });
      const email = insertEmail({ projectId, eventId: null, kind: "anchor", to: [project.ownerEmail], subject, body: text, status: r.status === "sent" ? "sent" : r.status === "preview" ? "preview" : "failed", provider: r.provider, messageId: r.messageId, response: r.response, sentBy: opts.by ?? null });
      if (r.status === "failed") out.errors.push(`Email to ${project.ownerEmail} failed: ${r.response}`);
      else
        out.created.push(insertAnchor({ projectId, headSeq: head.seq, headHash: head.hash, kind: "email", status: r.status === "sent" ? "sent" : "preview", detail: { to: project.ownerEmail, emailId: email.id, messageId: r.messageId, delivered: r.status === "sent", note: r.status === "preview" ? "No email provider configured — recorded but not delivered, so this does NOT count as an external anchor." : undefined } }));
    }
  } else if (opts.email !== false && !project.ownerEmail) out.skipped.push("No owner’s rep email set — add one in project settings to email the chain head.");

  return out;
}
