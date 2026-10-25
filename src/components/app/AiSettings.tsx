"use client";
import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Trash2, X } from "lucide-react";
import { ANTHROPIC_MODELS, COMPAT_PRESETS, validateConfig, type AiConfig, type ProviderId } from "@/lib/ai/config";
import { clearAi, loadAi, saveAi } from "@/lib/ai/client-config";
import { Button, Pill } from "@/components/ui";
import { cn } from "@/lib/format";

const field = "h-11 w-full border border-line bg-field px-3.5 text-[14px] outline-none transition-colors focus:border-ink/50";

const PROVIDERS: { id: ProviderId; title: string; sub: string }[] = [
  { id: "anthropic", title: "Claude", sub: "Paste an Anthropic API key" },
  { id: "openai-compatible", title: "Any other API", sub: "OpenAI, OpenRouter, Groq, Together, Ollama…" },
  { id: "offline", title: "Offline", sub: "Built-in rules, nothing leaves the site" },
];

type TestState = null | { busy: true } | { ok: true; engine: string; model: string | null; ms: number; found: { events: number; manpower: number } } | { ok: false; error: string };

export function AiSettings({ onDone }: { onDone?: () => void }) {
  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<string>(ANTHROPIC_MODELS[0].id);
  const [baseUrl, setBaseUrl] = useState<string>(COMPAT_PRESETS[0].baseUrl);
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<TestState>(null);
  const [saved, setSaved] = useState(false);
  const [hadKey, setHadKey] = useState(false);

  useEffect(() => {
    const c = loadAi();
    if (!c) return;
    setProvider(c.provider);
    setApiKey(c.apiKey);
    setModel(c.model || (c.provider === "anthropic" ? ANTHROPIC_MODELS[0].id : COMPAT_PRESETS[0].model));
    setBaseUrl(c.baseUrl || COMPAT_PRESETS[0].baseUrl);
    setRemember(c.remember);
    setHadKey(true);
  }, []);

  const cfg = (): AiConfig => ({ provider, apiKey: apiKey.trim().replace(/^["']|["']$/g, ""), model: model.trim(), baseUrl: provider === "openai-compatible" ? baseUrl.trim() : "" });
  const problem = validateConfig(cfg());
  const preset = COMPAT_PRESETS.find((p) => p.baseUrl === baseUrl);
  const keyOptional = provider === "openai-compatible" && preset?.needsKey === false;

  function pickProvider(p: ProviderId) {
    setProvider(p);
    setTest(null);
    setSaved(false);
    if (p === "anthropic" && !ANTHROPIC_MODELS.some((m) => m.id === model)) setModel(ANTHROPIC_MODELS[0].id);
    if (p === "openai-compatible" && ANTHROPIC_MODELS.some((m) => m.id === model)) { setModel(COMPAT_PRESETS[0].model); setBaseUrl(COMPAT_PRESETS[0].baseUrl); }
  }

  async function runTest() {
    setTest({ busy: true });
    try {
      const res = await fetch("/api/ai/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cfg()) });
      const body = await res.json();
      setTest(res.ok ? body : { ok: false, error: body.error ?? "Test failed" });
    } catch {
      setTest({ ok: false, error: "Couldn’t reach the server." });
    }
  }

  function save() {
    saveAi(cfg(), remember);
    setSaved(true);
    setHadKey(true);
    setTimeout(() => onDone?.(), 650);
  }
  function remove() {
    clearAi();
    setApiKey("");
    setHadKey(false);
    setTest(null);
    setSaved(false);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-2 sm:grid-cols-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => pickProvider(p.id)}
            data-cursor
            className={cn("border p-4 text-left transition-colors", provider === p.id ? "border-safety bg-safety-soft" : "border-line hover:border-ink/40")}
          >
            <div className={cn("text-[15px] font-semibold", provider === p.id && "text-safety")}>{p.title}</div>
            <div className="mt-1 text-[12px] leading-snug text-mute">{p.sub}</div>
          </button>
        ))}
      </div>

      {provider === "anthropic" && (
        <div className="space-y-4">
          <label className="block">
            <span className="label">Anthropic API key</span>
            <div className="relative mt-1.5">
              <input type={show ? "text" : "password"} value={apiKey} onChange={(e) => { setApiKey(e.target.value); setTest(null); }} placeholder="sk-ant-api03-…" autoComplete="off" spellCheck={false} className={cn(field, "pr-11 font-mono text-[13px]")} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide key" : "Show key"} className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-mute hover:text-ink">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12.5px] text-mute underline underline-offset-4 hover:text-safety">Get a key at console.anthropic.com ↗</a>
          </label>
          <div>
            <span className="label">Model</span>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
              {ANTHROPIC_MODELS.map((m) => (
                <button key={m.id} onClick={() => { setModel(m.id); setTest(null); }} className={cn("border px-3 py-2.5 text-left transition-colors", model === m.id ? "border-ink" : "border-line hover:border-ink/40")}>
                  <div className="text-[13.5px] font-medium">{m.label}</div>
                  <div className="text-[11.5px] text-mute">{m.note}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {provider === "openai-compatible" && (
        <div className="space-y-4">
          <div>
            <span className="label">Quick fill</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {COMPAT_PRESETS.map((p) => (
                <button key={p.id} onClick={() => { setBaseUrl(p.baseUrl); setModel(p.model); setTest(null); }} className={cn("border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.05em] transition-colors", baseUrl === p.baseUrl ? "border-safety text-safety" : "border-line text-ink-2 hover:border-ink/40")}>{p.label}</button>
              ))}
            </div>
          </div>
          <label className="block"><span className="label">API base URL</span><input value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); setTest(null); }} placeholder="https://api.openai.com/v1" className={cn(field, "mt-1.5 font-mono text-[13px]")} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Model</span><input value={model} onChange={(e) => { setModel(e.target.value); setTest(null); }} className={cn(field, "mt-1.5 font-mono text-[13px]")} /></label>
            <label className="block">
              <span className="label">API key {keyOptional && "(optional)"}</span>
              <div className="relative mt-1.5">
                <input type={show ? "text" : "password"} value={apiKey} onChange={(e) => { setApiKey(e.target.value); setTest(null); }} autoComplete="off" spellCheck={false} className={cn(field, "pr-11 font-mono text-[13px]")} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label="Toggle key visibility" className="absolute right-0 top-0 grid h-11 w-11 place-items-center text-mute hover:text-ink">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </label>
          </div>
          <p className="text-[12.5px] leading-relaxed text-mute">Works with any <span className="hash">/chat/completions</span> endpoint. Local models (Ollama, LM Studio) need Plumbline running on your own machine — a hosted server can’t reach your localhost.</p>
        </div>
      )}

      {provider === "offline" && (
        <p className="border border-line p-4 text-[14px] leading-relaxed text-ink-2">The built-in rules engine reads common site phrasing with no network call and no key. It’s the fastest way to try the product; a model handles unusual wording better.</p>
      )}

      {provider !== "offline" && (
        <label className="flex cursor-pointer items-start gap-3 text-[13.5px] text-ink-2">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-1 accent-[var(--color-safety)]" />
          <span>Remember on this device <span className="text-mute">— otherwise the key is forgotten when you close this tab.</span></span>
        </label>
      )}

      <div className="flex items-start gap-3 border border-line bg-field p-4 text-[12.5px] leading-relaxed text-ink-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
        <div>Your key stays in this browser. It travels to Plumbline over HTTPS <b>only as a header on each request</b>, is used for that one call, and is never saved, logged or shown to anyone else. Use a key with a spending limit; for sensitive projects, self-host Plumbline.</div>
      </div>

      {test && "busy" in test && <div className="flex items-center gap-2 text-[13px] text-mute"><Loader2 className="h-4 w-4 animate-spin" /> Calling the API with a sample entry…</div>}
      {test && "ok" in test && test.ok && (
        <div className="flex flex-wrap items-center gap-2 border border-ok/40 bg-ok-soft p-3 text-[13px] text-ok">
          <Check className="h-4 w-4" /> Connected · <b>{test.model ?? "offline"}</b> · {test.ms} ms · found {test.found.events} event, {test.found.manpower} workers in the sample
        </div>
      )}
      {test && "ok" in test && !test.ok && <div className="flex items-start gap-2 border border-bad/40 bg-bad-soft p-3 text-[13px] text-bad"><X className="mt-0.5 h-4 w-4 shrink-0" /> {test.error}</div>}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
        {provider !== "offline" && (
          <Button variant="ghost" onClick={runTest} disabled={!!problem || (test !== null && "busy" in test)}><KeyRound className="h-4 w-4" /> Test connection</Button>
        )}
        <Button variant="safety" onClick={save} disabled={!!problem}>{saved ? <><Check className="h-4 w-4" /> Saved</> : "Use this engine"}</Button>
        {hadKey && <button onClick={remove} className="ml-auto flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-mute hover:text-bad"><Trash2 className="h-3.5 w-3.5" /> Remove key</button>}
        {problem && provider !== "offline" && apiKey === "" && <Pill className="bg-paper-2 text-mute">{problem}</Pill>}
      </div>
    </div>
  );
}
