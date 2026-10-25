import { emptyExtraction, type Extraction } from "@/lib/domain/schema";
import { extractLocal } from "./local";
import { describeAnthropicError, extractWithClaude, hasAnthropicKey } from "./anthropic";
import { extractWithCompat, ProviderError } from "./openai-compat";
import { UnsafeUrlError } from "./safe-url";
import type { AiConfig } from "./config";

export interface ExtractResult {
  extraction: Extraction;
  provider: { name: "claude" | "local" | "custom"; model: string | null };
  note?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Anti-hallucination guard: a quote is only kept if it really appears in the transcript.
 * A paraphrased "quote" would look like evidence but isn't, so it is dropped (which lowers the evidence score).
 */
export function enforceVerbatimQuotes(x: Extraction, transcript: string): Extraction {
  const hay = norm(transcript);
  return {
    ...x,
    events: x.events.map((e) => ({
      ...e,
      quote: e.quote && hay.includes(norm(e.quote)) ? e.quote : "",
      hoursLost: e.hoursLost !== null && e.hoursLost >= 0 && e.hoursLost <= 240 ? e.hoursLost : null,
    })),
    manpower: x.manpower.filter((m) => m.headcount > 0 && m.headcount < 2000),
  };
}

function explain(err: unknown): string {
  if (err instanceof ProviderError || err instanceof UnsafeUrlError) return err.message;
  return describeAnthropicError(err);
}

export async function extract(
  transcript: string,
  logDate?: string,
  cfg?: AiConfig | null,
  opts: { strict?: boolean } = {},
): Promise<ExtractResult> {
  const text = transcript.trim();
  if (!text) return { extraction: emptyExtraction(), provider: { name: "local", model: null } };
  const local = (note?: string): ExtractResult => ({ extraction: extractLocal(text), provider: { name: "local", model: null }, note });

  // 1. The visitor's own key / API (bring-your-own-key).
  if (cfg && cfg.provider !== "offline") {
    try {
      if (cfg.provider === "anthropic") {
        const { extraction, model } = await extractWithClaude(text, logDate, { apiKey: cfg.apiKey, model: cfg.model });
        return { extraction: enforceVerbatimQuotes(extraction, text), provider: { name: "claude", model } };
      }
      const extraction = await extractWithCompat(text, logDate, cfg);
      return { extraction: enforceVerbatimQuotes(extraction, text), provider: { name: "custom", model: cfg.model } };
    } catch (err) {
      if (opts.strict) throw new Error(explain(err));
      return local(`Your API call failed — ${explain(err)} Used the offline engine instead.`);
    }
  }
  if (cfg?.provider === "offline") return local();

  // 2. Server-configured key.
  if (process.env.PLUMBLINE_PROVIDER !== "local" && hasAnthropicKey()) {
    try {
      const { extraction, model } = await extractWithClaude(text, logDate);
      return { extraction: enforceVerbatimQuotes(extraction, text), provider: { name: "claude", model } };
    } catch (err) {
      return local(`Claude was unavailable (${explain(err)}); used the offline extractor.`);
    }
  }

  // 3. Offline rules engine.
  return local();
}
