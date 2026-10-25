import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractionSchema, type Extraction } from "@/lib/domain/schema";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";

export const DEFAULT_MODEL = "claude-opus-5-5";

export const hasAnthropicKey = () =>
  Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let shared: Anthropic | null = null;
const envClient = () => (shared ??= new Anthropic({ timeout: 60_000, maxRetries: 1 }));

export class RefusedError extends Error {}

export interface ClaudeCreds { apiKey?: string; model?: string }

/** Human-readable reason for the typed SDK errors — shown next to the Test button. */
export function describeAnthropicError(err: unknown): string {
  if (err instanceof RefusedError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "Anthropic rejected that API key (401). Check it and try again.";
  if (err instanceof Anthropic.PermissionDeniedError) return "That key doesn’t have permission for this model (403).";
  if (err instanceof Anthropic.NotFoundError) return "That model name wasn’t found for your account (404).";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited or out of credit on that Anthropic account (429).";
  if (err instanceof Anthropic.BadRequestError) return `Anthropic rejected the request (400): ${err.message.slice(0, 140)}`;
  if (err instanceof Anthropic.APIConnectionError) return "Couldn’t reach Anthropic from the server.";
  if (err instanceof Anthropic.APIError) return `Anthropic returned ${err.status ?? "an error"}.`;
  return err instanceof Error ? err.message : "Unknown error";
}

/**
 * Structured extraction with schema-validated output (messages.parse + zod).
 * Thinking is adaptive (the model default); effort is kept low because this is extraction, not reasoning.
 * With `creds.apiKey` the call uses the visitor's own key for this request only — it is never stored.
 */
export async function extractWithClaude(
  transcript: string,
  logDate?: string,
  creds?: ClaudeCreds,
): Promise<{ extraction: Extraction; model: string }> {
  const model = creds?.model || process.env.PLUMBLINE_MODEL || DEFAULT_MODEL;
  const client = creds?.apiKey ? new Anthropic({ apiKey: creds.apiKey, timeout: 60_000, maxRetries: 0 }) : envClient();
  const response = await client.messages.parse({
    model,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt(transcript, logDate) }],
    output_config: { effort: "low", format: zodOutputFormat(ExtractionSchema) },
  });

  if (response.stop_reason === "refusal") throw new RefusedError("The model declined this request.");
  if (!response.parsed_output) throw new Error("Claude returned output that did not match the schema.");
  return { extraction: response.parsed_output, model };
}
