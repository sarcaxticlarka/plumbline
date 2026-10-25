/**
 * End-to-end check of offline mode in a real Chrome: install the service worker, go offline, dictate and seal
 * (the entry must land in the on-device outbox), come back online and watch it seal exactly once.
 *
 *   npm run build && PLUMBLINE_DEMO=1 npx next start -p 3100     # in one terminal
 *   node scripts/e2e-offline.mjs                                  # in another (needs Google Chrome)
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TEXT =
  "Cloudy and about 50 degrees. We had twelve ironworkers and eight carpenters on site. The tower crane was shut down at ten thirty because of wind gusts, lost about four hours of steel hoisting.";

const log = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000, step = 300) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await fn(); if (v) return v; } catch { /* page navigated mid-check */ } await sleep(step); } return null; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`);
  const status = await page.evaluate(async () => (await fetch("/api/auth/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "maya@northline.test" }) })).status);
  log(status === 200, "signed in as the superintendent");

  const projects = await page.evaluate(async () => (await (await fetch("/api/projects")).json()));
  const pid = projects.find((p) => p.project.name.startsWith("Harbor")).project.id;
  const composer = `${BASE}/app/projects/${pid}/new`;

  await page.goto(`${BASE}/app`, { waitUntil: "load" });
  const swReady = await until(() => page.evaluate(async () => { const r = await navigator.serviceWorker?.getRegistration(); return !!r?.active; }));
  log(!!swReady, "service worker installed and active");
  await page.reload({ waitUntil: "load" }); // now controlled by the SW; PwaRegister warms the composer page into the cache
  const warmed = await until(() => page.evaluate(async (path) => { const c = await caches.keys(); for (const k of c) { if ((await (await caches.open(k)).keys()).some((r) => new URL(r.url).pathname === path)) return true; } return false; }, `/app/projects/${pid}/new`), 20000);
  log(!!warmed, "composer page cached for offline use");

  // ---- go offline (real network cut) ----
  await page.setOfflineMode(true);
  await page.goto(composer, { waitUntil: "domcontentloaded" });
  const opened = await until(() => page.evaluate(() => document.body.innerText.includes("Dictate the day")), 15000);
  log(!!opened, "composer opens with no network (served by the service worker)");

  await page.click("textarea");
  await page.keyboard.type(TEXT.slice(0, 40));
  await page.evaluate((t) => { const ta = document.querySelector("textarea"); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; set.call(ta, t); ta.dispatchEvent(new Event("input", { bubbles: true })); }, TEXT);
  const offlinePreview = await until(() => page.evaluate(() => document.body.innerText.includes("Offline — previewing with the built-in engine")), 10000);
  log(!!offlinePreview, "live preview works offline (rules engine runs in the browser)");

  const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Save for sync/i.test(x.textContent)); b?.click(); return !!b; });
  log(clicked, "button reads “Save for sync” while offline");
  const saved = await until(() => page.evaluate(() => document.body.innerText.toLowerCase().includes("saved on this device")), 8000);
  log(!!saved, "entry saved on the device");
  const queued = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("plumbline-offline"); r.onsuccess = () => { const q = r.result.transaction("outbox").objectStore("outbox").getAll(); q.onsuccess = () => res(q.result.map((i) => ({ id: i.id, status: i.status, projectId: i.projectId }))); }; }));
  log(queued.length === 1 && queued[0].projectId === pid, `outbox holds exactly one queued entry (${queued.length})`);

  // ---- back online ----
  await page.setOfflineMode(false);
  await page.goto(`${BASE}/app/projects/${pid}`, { waitUntil: "load" });
  const sealed = await until(async () => {
    const logs = await page.evaluate(async (p) => (await fetch(`/api/projects/${p}/logs`)).json(), pid);
    return logs.find((l) => l.content.clientId === queued[0].id) ?? null;
  }, 40000, 1000);
  log(!!sealed, "queued entry sealed automatically after reconnecting");
  if (sealed) {
    log(!!sealed.content.capturedAt, `capture time travelled with it (capturedAt ${sealed.content.capturedAt})`);
    log(Date.parse(sealed.createdAt) >= Date.parse(sealed.content.capturedAt), "sealed time is after captured time");
    const dupes = await page.evaluate(async (p, id) => (await (await fetch(`/api/projects/${p}/logs`)).json()).filter((l) => l.content.clientId === id).length, pid, queued[0].id);
    log(dupes === 1, "sealed exactly once (idempotent)");
    const verify = await page.evaluate(async (p) => (await fetch(`/api/projects/${p}/verify`)).json(), pid);
    log(verify.chain.ok === true, "hash chain still verifies");
  }
  const count = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open("plumbline-offline"); r.onsuccess = () => { const q = r.result.transaction("outbox").objectStore("outbox").count(); q.onsuccess = () => res(q.result); }; }));
  const emptied = await until(async () => (await count()) === 0, 30000, 500);
  log(!!emptied, "outbox is empty afterwards (server confirmed the entry, device copy cleared)");
} finally {
  await browser.close();
}
