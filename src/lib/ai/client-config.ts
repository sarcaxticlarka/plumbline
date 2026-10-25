"use client";
import { useMemo, useSyncExternalStore } from "react";
import { configToHeaders, type AiConfig } from "./config";

/**
 * Where the visitor's key lives: this browser only. "Remember on this device" uses localStorage; otherwise
 * sessionStorage, which disappears when the tab closes. The key is sent only as headers on Plumbline's own API calls.
 */
const KEY = "plumbline.ai.v1";
const EVT = "plumbline:ai";

export interface StoredAi extends AiConfig { remember: boolean }

function read(): string | null {
  try {
    return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function parse(raw: string | null): StoredAi | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as StoredAi;
    return c && typeof c.provider === "string" ? c : null;
  } catch {
    return null;
  }
}

export const loadAi = (): StoredAi | null => parse(read());

export function saveAi(cfg: AiConfig, remember: boolean) {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify({ ...cfg, remember }));
  } catch { /* storage blocked: the key just won't persist */ }
  window.dispatchEvent(new Event(EVT));
}

export function clearAi() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

export function aiHeaders(): Record<string, string> {
  const c = loadAi();
  return c ? configToHeaders(c) : {};
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useAiConfig(): StoredAi | null {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => parse(raw), [raw]);
}
