import "server-only";
import { z } from "zod";
import { emptyExtraction, ExtractionSchema, type Extraction } from "@/lib/domain/schema";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";
import { assertSafeBaseUrl } from "./safe-url";

/**
 * Generic adapter for any "chat completions"-style endpoint (OpenAI, OpenRouter, Groq, Together, Ollama, vLLM, LM Studio…).
 * Claude is handled by the official SDK in anthropic.ts; this file exists only so users can bring a different API.
 * These providers don't share a structured-output dialect, so we ask for JSON, then validate it against the same
 * zod contract and repair what we can.
 */
export class ProviderError extends Error {}

export interface CompatCreds { apiKey: string; model: string; baseUrl: string }

const stripFences = (s: string) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

function coerce(raw: unknown): Extraction {
  const strict = ExtractionSchema.safeParse(raw);
  if (strict.success) return strict.data;
  // Repair: fill whatever the model omitted from the empty shape, then re-validate.
  const merged = { ...emptyExtraction(), ...(typeof raw === "object" && raw ? raw : {}) };
  const repaired = ExtractionSchema.safeParse(merged);
  if (repaired.success) return repaired.data;
  throw new ProviderError("The model’s answer didn’t match the expected structure. Try a more capable model.");
}

function explain(status: number, body: string): string {
  const detail = body.slice(0, 160).replace(/\s+/g, " ");
  if (status === 401 || status === 403) return "The API rejected the key (unauthorized).";
  if (status === 404) return "Endpoint or model not found — check the base URL and model name.";
  if (status === 429) return "Rate limited or out of quota on that API.";
  return `The API returned ${status}${detail ? `: ${detail}` : ""}`;
}

export async function extractWithCompat(transcript: string, logDate: string | undefined, creds: CompatCreds): Promise<Extraction> {
  const base = await assertSafeBaseUrl(creds.baseUrl);
  const endpoint = `${base.toString().replace(/\/+$/, "")}/chat/completions`;
  const schema = JSON.stringify(z.toJSONSchema(ExtractionSchema));
  const system = `${SYSTEM_PROMPT}\n\nReturn ONLY one JSON object (no prose, no code fences) that conforms to this JSON Schema:\n${schema}`;

  const call = (json: boolean) =>
    fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...(creds.apiKey ? { authorization: `Bearer ${creds.apiKey}` } : {}) },
      body: JSON.stringify({
        model: creds.model,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt(transcript, logDate) },
        ],
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
      redirect: "error",
    });

  let res: Response;
  try {
    res = await call(true);
    if (res.status === 400) res = await call(false); // some servers reject response_format
  } catch (e) {
    throw new ProviderError(e instanceof Error && e.name === "TimeoutError" ? "The API took too long to answer." : "Couldn’t reach that API — check the base URL.");
  }
  if (!res.ok) throw new ProviderError(explain(res.status, await res.text().catch(() => "")));

  const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new ProviderError("The API returned an empty answer.");
  try {
    return coerce(JSON.parse(stripFences(content)));
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("The model didn’t return valid JSON. Try a more capable model.");
  }
}
