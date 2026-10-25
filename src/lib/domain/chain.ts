import { createHash } from "node:crypto";
import type { ChainResult, LogEntry, SealedContent } from "./types";

/** The hash that every project's chain starts from. */
export const GENESIS = "0".repeat(64);

/** Deterministic JSON: object keys sorted recursively so the same content always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");

export interface HashInput {
  seq: number;
  projectId: string;
  createdAt: string;
  prevHash: string;
  content: SealedContent;
}

/**
 * hash(n) = SHA-256( seq | projectId | createdAt | hash(n-1) | canonical(content) )
 * Changing any byte of any earlier entry changes every hash after it.
 */
export function computeHash(input: HashInput): string {
  return sha256(
    [input.seq, input.projectId, input.createdAt, input.prevHash, canonicalJson(input.content)].join("|"),
  );
}

export function verifyChain(entries: LogEntry[]): ChainResult {
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  let prev = GENESIS;
  let checked = 0;
  for (const e of sorted) {
    if (e.prevHash !== prev) {
      return {
        ok: false,
        checked,
        headHash: prev,
        brokenAtSeq: e.seq,
        reason: `Entry #${e.seq} does not link to the entry before it — an entry was removed, reordered or inserted.`,
      };
    }
    const expected = computeHash({
      seq: e.seq,
      projectId: e.projectId,
      createdAt: e.createdAt,
      prevHash: e.prevHash,
      content: e.content,
    });
    if (expected !== e.hash) {
      return {
        ok: false,
        checked,
        headHash: prev,
        brokenAtSeq: e.seq,
        reason: `Entry #${e.seq} no longer matches its seal — its content was changed after it was recorded.`,
      };
    }
    prev = e.hash;
    checked += 1;
  }
  return { ok: true, checked, headHash: prev };
}
