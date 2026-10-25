"use client";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, CloudOff, ExternalLink, HardDriveDownload, Link2, Loader2, Mic, Music, SkipForward, Square, Volume2, VolumeX, X } from "lucide-react";
import type { Preview } from "@/lib/services";
import type { Attachment, Gap, NoticeRules } from "@/lib/domain/types";
import { extractLocal } from "@/lib/ai/local";
import { evaluateEntry } from "@/lib/domain/evidence";
import { aiHeaders } from "@/lib/ai/client-config";
import { enqueue } from "@/lib/offline/outbox";
import { Button } from "@/components/ui";
import { EngineChip } from "@/components/app/EngineChip";
import { cn, shortHash } from "@/lib/format";
import { FlowBar, type FlowState } from "./FlowBar";
import { PreviewPanel } from "./PreviewPanel";
import { useRecorder } from "./useRecorder";
import { useSpeech } from "./useSpeech";

const SAMPLES: { label: string; text: string }[] = [
  {
    label: "Wind day",
    text: "Cloudy and about 50 degrees with strong wind from the west all day. We had 12 ironworkers, 9 carpenters from Atlas Framing and 5 laborers on site. The tower crane was shut down at nine thirty because of wind gusts and stayed down the rest of the day, lost about six hours of steel and rebar hoisting. Ironworkers couldn't get material up to level 4 so we moved them to cleanup and layout on level 3. Toolbox talk on wind and loose material. No incidents.",
  },
  {
    label: "RFI & change day",
    text: "Mostly sunny and 58 degrees. Ten carpenters and 6 laborers on site. The architect still hasn't answered RFI 42 on the beam conflict at grid C, so the ironworkers can't set the transfer beam. The owner's rep walked the site this morning and asked us to add two more outlets in the lobby, that's extra work and not in the contract. Carpenters stripped forms on level 3. The framing inspection on level 3 passed.",
  },
  {
    label: "Quiet day",
    text: "Clear and 61 degrees. 14 ironworkers and 6 laborers on site. Ironworkers tied rebar on level 4 slab, grid B to F. Laborers cleaned up the level 3 deck. Held a toolbox talk on fall protection, no incidents. The special inspector came by and the rebar inspection on level 3 passed.",
  },
];

/** What to start the sentence with so the answer lands in the right shape. */
const STARTERS: Record<string, string> = {
  hours: "We lost about ",
  cause: "The cause was ",
  trades: "That stopped the ",
  party: "I'm holding responsible: ",
  record: "As of this morning, ",
  corroboration: "Conditions on site were ",
  manpower: "On site today we had ",
  weather: "Weather today was ",
  work: "Work performed today: ",
  safety: "We held a toolbox talk on ",
};

const gapId = (g: Gap) => `${g.scope}-${g.eventIndex ?? "e"}-${g.key}`;
const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** The text that was added between two versions of the box (common prefix/suffix trimmed). */
function inserted(prev: string, next: string): string {
  let p = 0;
  while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
  let s = 0;
  while (s < prev.length - p && s < next.length - p && prev[prev.length - 1 - s] === next[next.length - 1 - s]) s++;
  return next.slice(p, next.length - s);
}

/** Photos and recordings. `att` is null until the file has actually reached the server (it stays null offline). */
interface Media {
  key: string;
  kind: "image" | "audio";
  name: string;
  mime: string;
  url: string;
  blob: Blob;
  att: Attachment | null;
  seconds?: number;
}

class NetErr extends Error {}

/** In the browser, offline: same rules engine and evidence scoring as the server, minus weather. */
function localPreview(text: string, logDate: string, images: number): Preview {
  const extraction = extractLocal(text);
  return {
    extraction,
    provider: { name: "local", model: null },
    note: "Offline — previewing with the built-in engine. Weather corroboration and your chosen model resume when you reconnect.",
    evidence: evaluateEntry(extraction, text, { photos: images, logDate, recordedOn: logDate, weatherVerdicts: extraction.events.map(() => "unavailable") }),
    weather: null,
    weatherNotes: [],
    weatherVerdicts: extraction.events.map(() => "unavailable" as const),
  };
}

interface Props {
  project: { id: string; name: string; rules: NoticeRules };
  today: string;
  serverEngine: { live: boolean; label: string };
  userName: string;
}

export function Composer({ project, today, serverEngine, userName }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [date, setDate] = useState(today);
  const [author, setAuthor] = useState(userName);
  const [media, setMedia] = useState<Media[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [sealed, setSealed] = useState<{ seq: number; hash: string; prev: string } | null>(null);
  const [queued, setQueued] = useState<{ words: number; files: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [online, setOnline] = useState(true);
  const [keepAudio, setKeepAudio] = useState(true);

  // Voice: dictation bursts typed in by Wispr Flow (or any dictation tool) vs words from the built-in mic.
  const [bursts, setBursts] = useState({ count: 0, words: 0 });
  const [micWords, setMicWords] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  // Guided "interview": Plumbline asks for each missing detail, you answer by voice.
  const [interview, setInterview] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [speak, setSpeak] = useState(false);
  const asked = useRef(new Set<string>());

  const area = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const usedVoice = useRef(false);
  const autoRec = useRef(false);
  const clientId = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 3200);
  }, []);

  useEffect(() => {
    try { const saved = localStorage.getItem("plumbline.author"); if (saved) setAuthor(saved); } catch { /* private mode */ }
    area.current?.focus(); // Flow types into whatever is focused: be ready the moment the page opens.
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => {
    if (!author) return;
    try { localStorage.setItem("plumbline.author", author); } catch { /* private mode */ }
  }, [author]);

  const focusEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, []);

  const append = useCallback((t: string) => {
    usedVoice.current = true;
    setMicWords((n) => n + wordCount(t));
    setText((cur) => (cur && !/\s$/.test(cur) ? cur + " " : cur) + t);
  }, []);

  /* ---------- media: upload when online, keep the Blob when not ---------- */
  const uploadMedia = useCallback(async (m: Media): Promise<Attachment | null> => {
    const fd = new FormData();
    fd.append("file", new File([m.blob], m.name, { type: m.mime }));
    let res: Response;
    try { res = await fetch("/api/uploads", { method: "POST", body: fd }); } catch { return null; }
    const body = await res.json().catch(() => ({}));
    if (res.status >= 500) return null;
    if (!res.ok) throw new Error(body.error ?? "Upload failed");
    return body as Attachment;
  }, []);

  const addMedia = useCallback(async (m: Media) => {
    setMedia((x) => (x.some((y) => y.key === m.key) ? x : [...x, m]));
    if (!navigator.onLine) return;
    try {
      const att = await uploadMedia(m);
      if (att) setMedia((x) => x.map((y) => (y.key === m.key ? { ...y, att } : y)));
    } catch (e) {
      setErr((e as Error).message);
      setMedia((x) => x.filter((y) => y.key !== m.key));
    }
  }, [uploadMedia]);

  function addFiles(files: FileList | File[]) {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      addMedia({ key: `${f.name}-${f.size}-${f.lastModified}`, kind: "image", name: f.name, mime: f.type, url: URL.createObjectURL(f), blob: f, att: null });
    }
  }

  const recorder = useRecorder((blob, mime, seconds) => {
    const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
    addMedia({ key: `rec-${Date.now()}`, kind: "audio", name: `entry-audio-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`, mime, url: URL.createObjectURL(blob), blob, att: null, seconds });
  });

  /* ---------- voice commands reach seal/skip through a ref so they never see stale state ---------- */
  const cmd = useRef<{ seal: () => void; skip: () => void }>({ seal: () => {}, skip: () => {} });

  const onFinal = useCallback(
    (t: string) => {
      const c = t.toLowerCase().replace(/[.,!?]/g, "").trim();
      if (/^(scratch that|undo that|delete that)$/.test(c)) {
        setText((x) => {
          const s = x.trimEnd();
          const i = Math.max(s.lastIndexOf(". ", s.length - 2), s.lastIndexOf("! "), s.lastIndexOf("? "), s.lastIndexOf("\n"));
          return i < 0 ? "" : s.slice(0, i + 1);
        });
        return showFlash("Command · scratched the last sentence");
      }
      if (/^(new line|new paragraph)$/.test(c)) {
        setText((x) => x.trimEnd() + "\n");
        return showFlash("Command · new paragraph");
      }
      if (/^(seal (the )?(entry|log|it)|submit (the )?entry)$/.test(c)) {
        showFlash("Command · sealing the entry");
        return cmd.current.seal();
      }
      if (/^(next question|skip( that| this)?)$/.test(c)) {
        showFlash("Command · skipped");
        return cmd.current.skip();
      }
      if (/^(start over|clear everything)$/.test(c)) {
        setText("");
        return showFlash("Command · cleared");
      }
      append(/[.!?]$/.test(t) ? t : t + ".");
    },
    [append, showFlash],
  );
  const speech = useSpeech(onFinal);

  // The built-in mic and the original-audio recording start and stop together (Flow users can record on its own).
  const startMic = useCallback(() => {
    speech.start();
    if (keepAudio && !recorder.recording) { autoRec.current = true; recorder.start(); }
  }, [speech, keepAudio, recorder]);
  const stopMic = useCallback(() => {
    speech.stop();
    if (autoRec.current) { autoRec.current = false; recorder.stop(); }
  }, [speech, recorder]);

  /* ---------- sealing, or queueing on this device when there's no signal ---------- */
  const seal = useCallback(async () => {
    if (text.trim().length < 20) return;
    setSealing(true);
    setErr(null);
    if (speech.listening) stopMic();
    if (recorder.recording) recorder.stop();
    const base = {
      logDate: date,
      author: author || "Superintendent",
      transcript: text.trim(),
      source: usedVoice.current || bursts.count > 0 ? "voice" : "text",
      addendumOf: null,
    };
    const queueIt = async () => {
      const done = media.filter((m) => m.att).map((m) => m.att!);
      const files = media.filter((m) => !m.att).map((m) => ({ blob: m.blob, name: m.name, mime: m.mime }));
      await enqueue({ id: clientId.current, projectId: project.id, createdAt: new Date().toISOString(), body: { ...base, attachments: done }, files });
      setQueued({ words: wordCount(text), files: media.length });
      setSealing(false);
      setTimeout(() => router.push(`/app/projects/${project.id}`), 3600);
    };
    if (!navigator.onLine) return queueIt();
    try {
      const attachments: Attachment[] = [];
      for (const m of media) {
        const att = m.att ?? (await uploadMedia(m));
        if (!att) throw new NetErr();
        attachments.push(att);
      }
      const res = await fetch(`/api/projects/${project.id}/logs`, {
        method: "POST",
        headers: { "content-type": "application/json", ...aiHeaders() },
        body: JSON.stringify({ ...base, attachments, clientId: clientId.current }),
      });
      const body = await res.json();
      if (res.status >= 500) throw new NetErr();
      if (!res.ok) throw new Error(body.error ?? "Could not seal the entry");
      setSealed({ seq: body.entry.seq, hash: body.entry.hash, prev: body.entry.prevHash });
      setTimeout(() => router.push(`/app/projects/${project.id}/logs/${body.entry.id}`), 2300);
    } catch (e) {
      // A dropped connection mid-seal is not an error to the superintendent: keep the entry safe and sync later.
      if (e instanceof NetErr || e instanceof TypeError) return queueIt();
      setErr((e as Error).message);
      setSealing(false);
    }
  }, [text, date, author, media, bursts.count, project.id, router, uploadMedia, speech.listening, stopMic, recorder]);
  cmd.current.seal = () => void seal();

  /* ---------- live extraction (server), or in-browser when offline; stale responses are aborted ---------- */
  const images = media.filter((m) => m.kind === "image").length;
  useEffect(() => {
    if (text.trim().length < 20) {
      setPreview(null);
      setLoading(false);
      return;
    }
    if (!online) {
      setPreview(localPreview(text, date, images));
      setLoading(false);
      return;
    }
    const ctl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/extract?project=${project.id}`, {
          method: "POST",
          headers: { "content-type": "application/json", ...aiHeaders() },
          body: JSON.stringify({ transcript: text, logDate: date, photos: images }),
          signal: ctl.signal,
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Preview failed");
        setPreview(await res.json());
        setErr(null);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (e instanceof TypeError) setPreview(localPreview(text, date, images)); // network dropped
        else setErr((e as Error).message);
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }, 650);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [text, date, images, project.id, online]);

  /* ---------- typing vs dictation: a burst of words arriving at once is voice ---------- */
  function onType(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    const added = inserted(text, next);
    const w = wordCount(added);
    if (added.length >= 14 && w >= 3) {
      setBursts((b) => ({ count: b.count + 1, words: b.words + w }));
      showFlash(`Flow heard ${w} word${w === 1 ? "" : "s"} ✓`);
    }
    setText(next);
  }

  /* ---------- guided interview ---------- */
  const queue = useMemo(
    () =>
      (preview?.evidence.gaps ?? []).filter((g) => {
        if (skipped.includes(gapId(g))) return false;
        if (g.key === "photos") return false;
        if (g.key === "corroboration" && g.scope === "event" && preview?.extraction.events[g.eventIndex ?? 0]?.cause !== "weather") return false; // needs a photo, not speech
        return true;
      }),
    [preview, skipped],
  );
  const active = interview ? queue[0] : undefined;
  const activeText = active
    ? `${active.scope === "event" && active.eventIndex !== undefined ? (preview?.extraction.events[active.eventIndex]?.title.split(" — ")[0] ?? "") + ": " : ""}${active.question}`
    : "";

  cmd.current.skip = () => {
    if (active) setSkipped((s) => [...s, gapId(active)]);
  };

  useEffect(() => {
    if (!active) return;
    const id = gapId(active);
    if (asked.current.has(id)) return;
    asked.current.add(id);
    const starter = STARTERS[active.key];
    if (starter) setText((cur) => (cur.trimEnd() ? cur.trimEnd() + "\n" : "") + starter);
    focusEnd();
    if (speak && typeof speechSynthesis !== "undefined") {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(activeText));
    }
  }, [active, activeText, speak, focusEnd]);

  function toggleInterview() {
    if (interview) {
      setInterview(false);
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
      return;
    }
    asked.current = new Set();
    setSkipped([]);
    setInterview(true);
  }

  function answer(g: Gap) {
    if (g.key === "photos" || (g.key === "corroboration" && preview?.extraction.events[g.eventIndex ?? 0]?.cause !== "weather")) {
      fileRef.current?.click();
      return;
    }
    const starter = STARTERS[g.key] ?? "";
    setText((cur) => (cur.trimEnd() ? cur.trimEnd() + "\n" : "") + starter);
    focusEnd();
  }

  const words = wordCount(text);
  const ready = text.trim().length >= 20 && !sealing;
  const voiceWords = bursts.words + micWords;
  const savedSec = Math.max(0, Math.round((voiceWords / 40) * 60 - (voiceWords / 150) * 60));
  const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`);

  const flow: FlowState = sealed || queued
    ? { kind: "hidden" }
    : speech.listening
      ? { kind: "mic" }
      : flash
        ? { kind: "heard", text: flash }
        : interview && active
          ? { kind: "ask", text: activeText }
          : focused
            ? { kind: "ready" }
            : { kind: "hidden" };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---------- capture ---------- */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className={cn("surface relative overflow-hidden p-5 transition-shadow md:p-6", dragging && "ring-2 ring-safety", (speech.listening || focused) && "border-safety/60")}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={speech.listening ? stopMic : startMic}
              aria-label={speech.listening ? "Stop dictation" : "Start dictation"}
              className={cn("relative grid h-14 w-14 shrink-0 place-items-center rounded-full transition-transform active:scale-95", speech.listening ? "bg-safety text-on-safety" : "bg-ink text-paper hover:bg-white")}
            >
              {speech.listening && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-safety" />}
              {speech.listening ? <Square className="relative h-5 w-5 fill-black" /> : <Mic className="relative h-6 w-6" />}
            </button>
            <div className="min-w-[200px] flex-1">
              <div className="text-[15px] font-semibold">{speech.listening ? "Listening — talk like you would to your foreman" : "Dictate the day"}</div>
              <div className="text-[13px] text-mute">Use <b className="text-ink-2">Wispr Flow</b> into the box, or tap the built-in mic.</div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2">
              <EngineChip server={serverEngine} variant="inline" />
              {!online && <span className="flex items-center gap-2 border border-warn/50 bg-warn-soft px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.05em] text-warn"><CloudOff className="h-3.5 w-3.5" /> Offline — entry will be saved on this device</span>}
            </div>
          </div>

          {/* voice strip: proof that the entry is being spoken, not typed */}
          <div className={cn("mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.05em]", voiceWords > 0 ? "border-safety/50 bg-safety-soft text-safety" : "border-line text-mute")}>
            <span className="flex items-center gap-2"><span className={cn("h-1.5 w-1.5 rounded-full", voiceWords > 0 ? "animate-pulse bg-safety" : "bg-mute")} /> {voiceWords > 0 ? "Voice entry" : "Waiting for your voice"}</span>
            {voiceWords > 0 ? (
              <>
                <span><b>{voiceWords}</b> words spoken</span>
                {bursts.count > 0 && <span><b>{bursts.count}</b> dictation burst{bursts.count === 1 ? "" : "s"}</span>}
                <span>≈ <b>{fmt(savedSec)}</b> saved vs typing</span>
              </>
            ) : (
              <a href="https://ref.wisprflow.ai/hhg" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-ink-2 normal-case tracking-normal underline underline-offset-4 hover:text-safety">Hold your Wispr Flow hotkey and speak — new here? Get Flow <ExternalLink className="h-3 w-3" /></a>
            )}
          </div>

          {/* original audio */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px]">
            <button
              onClick={() => (recorder.recording ? recorder.stop() : recorder.start())}
              data-cursor
              className={cn("flex items-center gap-2 border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.05em] transition-colors", recorder.recording ? "border-bad bg-bad-soft text-bad" : "border-line text-ink-2 hover:border-ink/50")}
            >
              <span className={cn("h-2 w-2 rounded-full", recorder.recording ? "animate-pulse bg-bad" : "bg-mute")} />
              {recorder.recording ? `Recording ${mmss(recorder.seconds)} — stop` : "Record original audio"}
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-mute">
              <input type="checkbox" checked={keepAudio} onChange={(e) => setKeepAudio(e.target.checked)} className="accent-[var(--color-safety)]" />
              keep audio when I use the built-in mic
            </label>
            <span className="text-mute">Hashed and sealed with the entry — works while dictating with Flow too.</span>
          </div>
          {recorder.error && <p className="mt-2 text-[12.5px] text-bad">{recorder.error}</p>}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label !text-[10px]">Log date</span>
              <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="mt-1 h-10 w-full border border-line bg-field px-3 text-[14px] outline-none focus:border-ink/40" />
            </label>
            <label className="block">
              <span className="label !text-[10px]">Recorded by</span>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1 h-10 w-full border border-line bg-field px-3 text-[14px] outline-none focus:border-ink/40" />
            </label>
          </div>

          {/* interview banner */}
          <AnimatePresence initial={false}>
            {interview && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-4 border border-safety bg-safety-soft p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="label !text-safety">{active ? `Question · ${queue.length} left` : preview ? "All answered" : "Reading your entry…"}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSpeak((v) => !v)} aria-label="Read questions aloud" className={cn("grid h-7 w-7 place-items-center border", speak ? "border-safety text-safety" : "border-line text-mute")}>{speak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}</button>
                      {active && <button onClick={() => cmd.current.skip()} className="flex h-7 items-center gap-1 border border-line px-2 font-mono text-[10px] uppercase text-ink-2 hover:border-ink/50"><SkipForward className="h-3 w-3" /> Skip</button>}
                      <button onClick={toggleInterview} className="flex h-7 items-center border border-line px-2 font-mono text-[10px] uppercase text-ink-2 hover:border-ink/50">{active ? "Stop" : "Done"}</button>
                    </div>
                  </div>
                  <p className="mt-2 text-[17px] font-medium leading-snug text-ink">{active ? activeText : preview ? "Nothing left to ask by voice. Review and seal when ready." : "Keep dictating — questions appear as soon as I’ve read the entry."}</p>
                  {active && <p className="mt-2 text-[12.5px] text-ink-2">Hold your Flow hotkey and answer — the box is ready and focused. Built-in mic: say “next question” to skip.</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative mt-4">
            <textarea
              ref={area}
              value={text}
              onChange={onType}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
              rows={12}
              placeholder={"“Overcast, about fifty degrees. Twelve ironworkers and eight carpenters on site. The crane was shut down at ten thirty for wind gusts, lost about four hours…”"}
              className="w-full resize-y border border-line bg-field p-4 text-[16px] leading-[1.65] outline-none transition-colors placeholder:text-mute/70 focus:border-safety/70"
            />
            {(speech.interim || speech.listening) && (
              <div className="pointer-events-none mt-2 min-h-5 text-[14px] italic text-safety">{speech.interim ? `“${speech.interim}”` : "…"}</div>
            )}
          </div>
          {speech.error && <p className="mt-2 text-[13px] text-bad">{speech.error}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="label !text-[10px]">Try a sample</span>
            {SAMPLES.map((s) => (
              <button key={s.label} onClick={() => setText(s.text)} className="border border-line px-3 py-1 text-[12.5px] text-ink-2 transition-colors hover:border-ink/40 hover:text-ink">{s.label}</button>
            ))}
            {text && <button onClick={() => setText("")} className="ml-auto text-[12.5px] text-mute hover:text-ink">Clear</button>}
          </div>
          {speech.supported && <p className="mt-3 text-[12px] text-mute">Built-in mic commands: <span className="hash">“scratch that”</span> · <span className="hash">“new paragraph”</span> · <span className="hash">“next question”</span> · <span className="hash">“seal entry”</span></p>}

          {/* photos & audio */}
          <div className="mt-5 border-t border-dashed border-line pt-4">
            <div className="flex items-center gap-3">
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 border border-line px-3.5 py-2 text-[13px] font-medium hover:border-ink/40">
                <Camera className="h-4 w-4" /> Add photos
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
              <span className="text-[12.5px] text-mute">Each file’s SHA-256 is sealed into the entry.</span>
            </div>
            {media.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {media.filter((m) => m.kind === "image").map((m) => (
                    <motion.div key={m.key} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="group relative h-16 w-16 overflow-hidden border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                      <button onClick={() => setMedia((x) => x.filter((y) => y.key !== m.key))} className="absolute right-0.5 top-0.5 hidden h-5 w-5 place-items-center rounded-full bg-black/80 text-white group-hover:grid" aria-label="Remove photo"><X className="h-3 w-3" /></button>
                      <span className={cn("hash absolute inset-x-0 bottom-0 bg-black/75 text-center text-[8.5px]", m.att ? "text-white" : "text-warn")}>{m.att ? m.att.sha256.slice(0, 8) : "on device"}</span>
                    </motion.div>
                  ))}
                </div>
                {media.filter((m) => m.kind === "audio").map((m) => (
                  <motion.div key={m.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 border border-line p-3">
                    <Music className="h-4 w-4 shrink-0 text-safety" />
                    <audio controls src={m.url} className="h-9 min-w-0 flex-1" />
                    <span className="hash text-mute">{m.seconds ? mmss(m.seconds) : ""} · {m.att ? m.att.sha256.slice(0, 10) : "stored on device"}</span>
                    <button onClick={() => setMedia((x) => x.filter((y) => y.key !== m.key))} aria-label="Remove recording" className="text-mute hover:text-bad"><X className="h-4 w-4" /></button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {err && <p className="mt-3 border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad">{err}</p>}

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-mute">{words} words</span>
            <Button variant="safety" size="lg" onClick={seal} disabled={!ready}>
              {sealing ? <Loader2 className="h-4 w-4 animate-spin" /> : online ? <Link2 className="h-4 w-4" /> : <HardDriveDownload className="h-4 w-4" />} {online ? "Seal entry" : "Save for sync"}
            </Button>
          </div>
        </div>
      </div>

      {/* ---------- live understanding ---------- */}
      <PreviewPanel preview={preview} loading={loading} rules={project.rules} logDate={date} onGap={answer} tooShort={text.trim().length < 20} onGuide={toggleInterview} guiding={interview} />

      <FlowBar state={flow} />

      {/* ---------- saved offline ---------- */}
      <AnimatePresence>
        {queued && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] grid place-items-center bg-night/92 p-6 backdrop-blur-md">
            <div className="drawing absolute inset-0 opacity-60" />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 20 }} className="relative w-full max-w-lg text-center text-white">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-warn text-black"><HardDriveDownload className="h-9 w-9" /></div>
              <h2 className="cond mt-6 text-[60px]">Saved on this device</h2>
              <p className="mx-auto mt-3 max-w-sm text-white/65">No signal, no problem. {queued.words} words{queued.files ? ` and ${queued.files} file${queued.files === 1 ? "" : "s"}` : ""} are stored safely and will seal automatically the moment you’re back online. The capture time is recorded with the entry.</p>
              <button onClick={() => router.push(`/app/projects/${project.id}`)} className="mt-7 border border-white/30 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.05em] hover:border-white">Back to logbook</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- seal ceremony ---------- */}
      <AnimatePresence>
        {sealed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] grid place-items-center bg-night/90 p-6 backdrop-blur-md">
            <div className="drawing absolute inset-0 opacity-60" />
            <motion.div initial={{ scale: 0.88, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 20 }} className="relative w-full max-w-lg text-center text-white">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 14 }} className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-safety text-black">
                <Check className="h-10 w-10" strokeWidth={3} />
              </motion.div>
              <h2 className="cond mt-6 text-[64px]">Sealed as entry #{sealed.seq}</h2>
              <p className="mt-3 text-white/60">Chained to the entry before it. Edit one byte and this seal fails.</p>
              <div className="mt-7 space-y-2 border border-white/15 bg-white/[0.05] p-4 text-left">
                <div className="label !text-white/40">this entry</div>
                <HashTyper value={sealed.hash} />
                <div className="label !text-white/40 pt-2">linked to</div>
                <div className="hash text-white/50">{shortHash(sealed.prev, 20)}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HashTyper({ value }: { value: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => (x >= value.length ? x : x + 3)), 16);
    return () => clearInterval(id);
  }, [value]);
  return <div className="hash break-all text-[13px] text-safety">{value.slice(0, n)}<span className="animate-blink">▍</span></div>;
}
