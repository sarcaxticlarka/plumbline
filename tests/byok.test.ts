import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { configFromHeaders, configToHeaders, validateConfig, HEADERS, type AiConfig } from "@/lib/ai/config";
import { assertSafeBaseUrl, isPrivateAddress, UnsafeUrlError } from "@/lib/ai/safe-url";
import { extract } from "@/lib/ai";
import { RICH_DAY } from "./fixtures";

const claude: AiConfig = { provider: "anthropic", apiKey: "sk-ant-api03-abcdefghijklmnop", model: "claude-sonnet-5-5", baseUrl: "" };

describe("bring-your-own-key config", () => {
  it("round-trips through headers", () => {
    const h = new Headers(configToHeaders(claude));
    expect(configFromHeaders(h)).toEqual(claude);
  });
  it("ignores malformed or incomplete headers instead of half-trusting them", () => {
    expect(configFromHeaders(new Headers())).toBeNull();
    expect(configFromHeaders(new Headers({ [HEADERS.provider]: "anthropic" }))).toBeNull(); // no key
    expect(configFromHeaders(new Headers({ [HEADERS.provider]: "anthropic", [HEADERS.key]: "bad key with spaces" }))).toBeNull();
    expect(configFromHeaders(new Headers({ [HEADERS.provider]: "openai-compatible", [HEADERS.key]: "sk-12345678", [HEADERS.model]: "m" }))).toBeNull(); // no base url
    expect(configFromHeaders(new Headers({ [HEADERS.provider]: "evil" }))).toBeNull();
  });
  it("validates what the settings form submits", () => {
    expect(validateConfig({ ...claude, apiKey: "" })).toMatch(/Paste/);
    expect(validateConfig({ provider: "openai-compatible", apiKey: "", model: "llama3.1", baseUrl: "" })).toMatch(/base URL/);
    expect(validateConfig({ provider: "offline", apiKey: "", model: "", baseUrl: "" })).toBeNull();
  });
});

describe("SSRF guard", () => {
  it("classifies private and public addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.9", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
  it("blocks internal targets and plain http in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(assertSafeBaseUrl("http://api.example.com/v1")).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertSafeBaseUrl("https://169.254.169.254/latest")).rejects.toThrow(/private/);
    await expect(assertSafeBaseUrl("https://127.0.0.1:11434/v1")).rejects.toThrow(/private/);
    await expect(assertSafeBaseUrl("https://user:pw@example.com/v1")).rejects.toThrow(/credentials/);
    await expect(assertSafeBaseUrl("ftp://example.com")).rejects.toThrow();
    vi.unstubAllEnvs();
  });
  it("allows localhost when self-hosting (non-production)", async () => {
    await expect(assertSafeBaseUrl("http://localhost:11434/v1")).resolves.toBeInstanceOf(URL);
  });
});

describe("OpenAI-compatible adapter (against a real local HTTP server)", () => {
  let server: http.Server;
  let base = "";
  let seen: { auth?: string; body?: Record<string, unknown> } = {};
  let mode: "good" | "fenced" | "partial" | "unauthorized" | "garbage" = "good";

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        seen = { auth: req.headers.authorization, body: raw ? JSON.parse(raw) : undefined };
        if (mode === "unauthorized") { res.writeHead(401).end("nope"); return; }
        const payload = {
          summary: "Crane down for wind.",
          weather: { conditions: "windy", highTempF: null, precipitationMentioned: false, windMentioned: true },
          manpower: [{ trade: "Ironworkers", headcount: 12, hours: null, company: null }],
          equipment: [], work: [], deliveries: [], inspections: [], safety: [], visitors: [],
          events: [{ kind: "delay", title: "Wind — crane stand-down", description: "Crane shut down.", cause: "weather", hoursLost: 4, tradesAffected: ["Hoist"], responsibleParty: "weather", criticalPathLikely: true, quote: "The tower crane was shut down at ten thirty because of wind gusts" }],
          openItems: [],
        };
        let content: string;
        if (mode === "fenced") content = "```json\n" + JSON.stringify(payload) + "\n```";
        else if (mode === "partial") content = JSON.stringify({ summary: "x", events: payload.events }); // omitted arrays get repaired
        else if (mode === "garbage") content = "I'm sorry, I can't do that.";
        else content = JSON.stringify(payload);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ choices: [{ message: { content } }] }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  });
  afterAll(() => new Promise((r) => server.close(() => r(null))));

  const cfg = (): AiConfig => ({ provider: "openai-compatible", apiKey: "sk-testkey123", model: "my-model", baseUrl: base });

  it("sends the key as a bearer token and validates the answer against the shared schema", async () => {
    mode = "good";
    const r = await extract(RICH_DAY, "2026-10-20", cfg(), { strict: true });
    expect(seen.auth).toBe("Bearer sk-testkey123");
    expect(seen.body?.model).toBe("my-model");
    expect(r.provider).toEqual({ name: "custom", model: "my-model" });
    expect(r.extraction.events[0]).toMatchObject({ cause: "weather", hoursLost: 4 });
    expect(r.extraction.events[0].quote).toMatch(/shut down/); // verbatim, so it survives the guard
  });
  it("tolerates code fences and repairs omitted fields", async () => {
    mode = "fenced";
    expect((await extract(RICH_DAY, undefined, cfg(), { strict: true })).extraction.manpower[0].headcount).toBe(12);
    mode = "partial";
    const r = await extract(RICH_DAY, undefined, cfg(), { strict: true });
    expect(r.extraction.events).toHaveLength(1);
    expect(r.extraction.equipment).toEqual([]);
  });
  it("explains failures in strict mode and silently falls back otherwise", async () => {
    mode = "unauthorized";
    await expect(extract(RICH_DAY, undefined, cfg(), { strict: true })).rejects.toThrow(/rejected the key/);
    const soft = await extract(RICH_DAY, undefined, cfg());
    expect(soft.provider.name).toBe("local");
    expect(soft.note).toMatch(/offline engine/i);
    mode = "garbage";
    await expect(extract(RICH_DAY, undefined, cfg(), { strict: true })).rejects.toThrow(/valid JSON/);
  });
  it("never sends a key anywhere when the user picks the offline engine", async () => {
    mode = "good"; seen = {};
    const r = await extract(RICH_DAY, undefined, { provider: "offline", apiKey: "", model: "", baseUrl: "" });
    expect(r.provider.name).toBe("local");
    expect(seen.auth).toBeUndefined();
  });
});
