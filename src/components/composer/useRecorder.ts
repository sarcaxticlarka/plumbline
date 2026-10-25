"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const MAX_SECONDS = 20 * 60;

/**
 * Keeps the original audio of the entry. It records the microphone with MediaRecorder next to (not instead of)
 * live transcription — so it works with the built-in mic AND while dictating with Wispr Flow in the same room.
 * The file is hashed on upload and sealed into the entry like a photo.
 */
export function useRecorder(onFinish: (blob: Blob, mime: string, seconds: number) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const cb = useRef(onFinish);
  cb.current = onFinish;

  const cleanup = useCallback(() => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    rec.current = null;
    setRecording(false);
  }, []);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
    else cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    if (rec.current) return;
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording isn’t supported in this browser.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(s, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        const secs = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        const blob = new Blob(chunks.current, { type: r.mimeType || mimeType || "audio/webm" });
        cleanup();
        if (blob.size > 0) cb.current(blob, (r.mimeType || mimeType || "audio/webm").split(";")[0], secs);
      };
      rec.current = r;
      started.current = Date.now();
      setSeconds(0);
      r.start(1000);
      setRecording(true);
      timer.current = setInterval(() => {
        const s2 = Math.round((Date.now() - started.current) / 1000);
        setSeconds(s2);
        if (s2 >= MAX_SECONDS) stop();
      }, 500);
    } catch {
      cleanup();
      setError("Microphone access was blocked — allow it to keep the original audio.");
    }
  }, [cleanup, stop]);

  useEffect(() => () => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return { recording, seconds, error, start, stop };
}
