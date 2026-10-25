"use client";
/**
 * Offline outbox: entries dictated with no signal are kept in IndexedDB (including photos and audio as Blobs)
 * and sealed when the connection returns. The device time of capture travels with the entry as `capturedAt`
 * and is shown as device-reported (a phone clock can't be trusted the way the server's can).
 */
const DB = "plumbline-offline";
const STORE = "outbox";
const CHANNEL = "plumbline-outbox";

export interface OutboxFile { blob: Blob; name: string; mime: string }
export interface OutboxItem {
  id: string;
  projectId: string;
  createdAt: string;
  body: Record<string, unknown>;
  files: OutboxFile[];
  status: "queued" | "failed";
  error?: string;
  tries: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(r.result); };
    t.onerror = t.onabort = () => { db.close(); reject(t.error); };
  });
};

function notify() {
  window.dispatchEvent(new Event("plumbline:outbox"));
  try { new BroadcastChannel(CHANNEL).postMessage("changed"); } catch { /* unsupported */ }
}
export function onOutboxChange(cb: () => void): () => void {
  window.addEventListener("plumbline:outbox", cb);
  let bc: BroadcastChannel | null = null;
  try { bc = new BroadcastChannel(CHANNEL); bc.onmessage = cb; } catch { /* unsupported */ }
  return () => { window.removeEventListener("plumbline:outbox", cb); bc?.close(); };
}

export async function enqueue(item: Pick<OutboxItem, "projectId" | "createdAt" | "body" | "files"> & { id?: string }): Promise<OutboxItem> {
  // The caller may pass the same clientId it tried online with, so a half-delivered request can never duplicate.
  const full: OutboxItem = { ...item, id: item.id ?? crypto.randomUUID(), status: "queued", tries: 0 };
  await tx("readwrite", (s) => s.put(full));
  notify();
  return full;
}
export async function listOutbox(): Promise<OutboxItem[]> {
  const all = await tx<OutboxItem[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function removeItem(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  notify();
}
async function update(item: OutboxItem) {
  await tx("readwrite", (s) => s.put(item));
  notify();
}
export async function retryItem(id: string) {
  const all = await listOutbox();
  const it = all.find((x) => x.id === id);
  if (it) await update({ ...it, status: "queued", error: undefined });
}

export interface FlushResult { sealed: number; failed: number; remaining: number; stopped?: string }

class NetworkError extends Error {}

async function upload(f: OutboxFile): Promise<{ sha256: string; name: string; size: number; mime: string }> {
  const fd = new FormData();
  fd.append("file", new File([f.blob], f.name, { type: f.mime }));
  let res: Response;
  try { res = await fetch("/api/uploads", { method: "POST", body: fd }); } catch { throw new NetworkError("offline"); }
  if (res.status === 401) throw new NetworkError("Sign in again to finish syncing.");
  if (res.status >= 500) throw new NetworkError("Server unavailable");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
  return body;
}

let flushing = false;

/** Seal queued entries in the order they were captured. Stops (keeping everything) on any connectivity problem. */
export async function flushOutbox(headers: () => Record<string, string>): Promise<FlushResult> {
  const out: FlushResult = { sealed: 0, failed: 0, remaining: 0 };
  if (flushing) return { ...out, remaining: (await listOutbox()).length };
  flushing = true;
  try {
    for (const item of (await listOutbox()).filter((i) => i.status === "queued")) {
      try {
        const attachments = [...((item.body.attachments as unknown[]) ?? [])];
        for (const f of item.files) attachments.push(await upload(f));
        let res: Response;
        try {
          res = await fetch(`/api/projects/${item.projectId}/logs`, {
            method: "POST",
            headers: { "content-type": "application/json", ...headers() },
            body: JSON.stringify({ ...item.body, attachments, capturedAt: item.createdAt, clientId: item.id }),
          });
        } catch { throw new NetworkError("offline"); }
        if (res.status === 401) throw new NetworkError("Sign in again to finish syncing.");
        if (res.status >= 500 || res.status === 429) throw new NetworkError("Server busy — will retry");
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `Rejected (${res.status})`);
        await removeItem(item.id);
        out.sealed += 1;
      } catch (e) {
        if (e instanceof NetworkError) { out.stopped = e.message; break; }
        await update({ ...item, status: "failed", error: (e as Error).message, tries: item.tries + 1 });
        out.failed += 1;
      }
    }
  } finally {
    flushing = false;
  }
  out.remaining = (await listOutbox()).filter((i) => i.status === "queued").length;
  return out;
}
