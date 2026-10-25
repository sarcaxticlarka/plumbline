/**
 * Bring-your-own-key configuration, shared by browser and server.
 *
 * The key lives in the user's browser (localStorage or sessionStorage) and is attached to each request as headers.
 * The server uses it for that one call and never stores or logs it.
 */
export type ProviderId = "anthropic" | "openai-compatible" | "offline";

export interface AiConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export const ANTHROPIC_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Most capable · default" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Faster, lower cost" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Cheapest" },
] as const;

export const COMPAT_PRESETS = [
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", needsKey: true },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini", needsKey: true },
  { id: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", needsKey: true },
  { id: "together", label: "Together", baseUrl: "https://api.together.xyz/v1", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", needsKey: true },
  { id: "ollama", label: "Ollama (self-hosted)", baseUrl: "http://localhost:11434/v1", model: "llama3.1", needsKey: false },
] as const;

export const HEADERS = {
  provider: "x-plumbline-provider",
  key: "x-plumbline-key",
  model: "x-plumbline-model",
  base: "x-plumbline-base-url",
} as const;

const KEY_RE = /^[A-Za-z0-9_\-.:~+/=]{8,512}$/;
const MODEL_RE = /^[A-Za-z0-9_\-.:/]{2,120}$/;

export function configToHeaders(c: AiConfig): Record<string, string> {
  const h: Record<string, string> = { [HEADERS.provider]: c.provider };
  if (c.apiKey) h[HEADERS.key] = c.apiKey;
  if (c.model) h[HEADERS.model] = c.model;
  if (c.baseUrl) h[HEADERS.base] = c.baseUrl;
  return h;
}

/** Strictly validated: anything malformed is ignored (falls back to the server default), never half-trusted. */
export function configFromHeaders(h: Headers): AiConfig | null {
  const provider = h.get(HEADERS.provider);
  if (provider !== "anthropic" && provider !== "openai-compatible" && provider !== "offline") return null;
  if (provider === "offline") return { provider, apiKey: "", model: "", baseUrl: "" };

  const apiKey = (h.get(HEADERS.key) ?? "").trim();
  const model = (h.get(HEADERS.model) ?? "").trim();
  const baseUrl = (h.get(HEADERS.base) ?? "").trim();
  if (apiKey && !KEY_RE.test(apiKey)) return null;
  if (model && !MODEL_RE.test(model)) return null;
  if (provider === "anthropic") return apiKey ? { provider, apiKey, model, baseUrl: "" } : null;
  if (!baseUrl || baseUrl.length > 300 || !model) return null;
  return { provider, apiKey, model, baseUrl };
}

export function validateConfig(c: AiConfig): string | null {
  if (c.provider === "offline") return null;
  if (c.apiKey && !KEY_RE.test(c.apiKey)) return "That API key contains characters keys don’t use — check for stray spaces or quotes.";
  if (c.model && !MODEL_RE.test(c.model)) return "Model name looks invalid.";
  if (c.provider === "anthropic") return c.apiKey ? null : "Paste your Anthropic API key.";
  if (!c.baseUrl) return "Enter the API base URL.";
  if (!c.model) return "Enter a model name.";
  return null;
}
