"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all targets). */
interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlternative }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SRInstance {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: SREvent) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void;
}
type SRCtor = new () => SRInstance;

/**
 * Live dictation through the browser's speech recognition. Dictation tools such as Wispr Flow need none of this —
 * they type straight into the text box — so the composer works with either.
 */
export function useSpeech(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SRInstance | null>(null);
  const want = useRef(false);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      want.current = false;
      rec.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Speech recognition isn’t available in this browser. Use Chrome or Edge — or dictate with Wispr Flow straight into the box.");
      return;
    }
    setError(null);
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const t = res[0].transcript.trim();
          if (t) cb.current(t);
        } else live += res[0].transcript;
      }
      setInterim(live.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        want.current = false;
        setListening(false);
        setError("Microphone access was blocked. Allow it in your browser, or type / dictate into the box.");
      }
    };
    r.onend = () => {
      if (want.current) {
        try { r.start(); } catch { /* already started */ }
      } else {
        setListening(false);
        setInterim("");
      }
    };
    want.current = true;
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Couldn’t start the microphone.");
    }
  }, []);

  const stop = useCallback(() => {
    want.current = false;
    rec.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  return { supported, listening, interim, error, start, stop };
}
