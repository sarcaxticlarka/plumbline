/**
 * End-to-end check of "keep the original audio" with Chrome's fake microphone, plus the sign-in UI:
 * click a demo role, record, seal, then confirm the recording is in the sealed entry and playable (HTTP Range).
 *
 *   PLUMBLINE_DEMO=1 npx next start -p 3100   then   node scripts/e2e-audio.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TEXT = "Clear and 61 degrees. Fourteen ironworkers and six laborers on site. Ironworkers tied rebar on level 4 slab, grid B to F. Held a toolbox talk on fall protection, no incidents.";
const log = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000, step = 300) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await fn(); if (v) return v; } catch { /* navigating */ } await sleep(step); } return null; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Maya Chen/.test(b.textContent)).click());
  const inApp = await until(() => page.evaluate(() => location.pathname === "/app" && document.body.innerText.toLowerCase().includes("site control")), 30000);
  log(!!inApp, "clicked “Maya Chen” on the login screen and landed in the app");

  const projects = await page.evaluate(async () => (await (await fetch("/api/projects")).json()));
  const pid = projects.find((p) => p.project.name.startsWith("Harbor")).project.id;
  await page.goto(`${BASE}/app/projects/${pid}/new`, { waitUntil: "load" });
  await until(() => page.evaluate(() => document.body.innerText.includes("Dictate the day")));
  await page.evaluate((t) => { const ta = document.querySelector("textarea"); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta, t); ta.dispatchEvent(new Event("input", { bubbles: true })); }, TEXT);

  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Record original audio/i.test(b.textContent)).click());
  const rec = await until(() => page.evaluate(() => /recording \d+:\d+/i.test(document.body.innerText)), 8000);
  log(!!rec, "recording started (timer running)");
  await sleep(2600);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Recording .*stop/i.test(b.textContent)).click());
  const ready = await until(() => page.evaluate(() => { const a = document.querySelector("audio[controls]"); return a && !/stored on device/.test(document.body.innerText); }), 15000);
  log(!!ready, "recording uploaded and hashed (player + SHA-256 shown)");

  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Seal entry/i.test(b.textContent)).click());
  const detail = await until(() => page.evaluate(() => /\/logs\//.test(location.pathname)), 25000);
  log(!!detail, "entry sealed and opened");
  await until(() => page.evaluate(() => document.body.innerText.toLowerCase().includes("original audio")), 15000);
  log(await page.evaluate(() => document.body.innerText.toLowerCase().includes("original audio · sealed")), "entry page shows “Original audio · sealed”");

  const info = await page.evaluate(async (p) => {
    const logs = await (await fetch(`/api/projects/${p}/logs`)).json();
    const last = logs[logs.length - 1];
    const att = last.content.attachments.find((a) => a.mime.startsWith("audio/"));
    if (!att) return null;
    const full = await fetch(`/api/uploads/${att.sha256}`);
    const part = await fetch(`/api/uploads/${att.sha256}`, { headers: { range: "bytes=0-99" } });
    const buf = new Uint8Array(await full.arrayBuffer());
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const verify = await (await fetch(`/api/projects/${p}/verify`)).json();
    return { mime: att.mime, size: buf.length, hashMatches: digest === att.sha256, rangeStatus: part.status, rangeType: part.headers.get("content-type"), chainOk: verify.chain.ok, inSeal: true };
  }, pid);
  log(!!info, "sealed entry lists an audio attachment");
  if (info) {
    log(info.size > 1000, `audio is real (${info.mime}, ${info.size} bytes)`);
    log(info.hashMatches, "downloaded bytes hash to exactly the sealed SHA-256");
    log(info.rangeStatus === 206 && info.rangeType.startsWith("audio/"), "HTTP Range works (needed for <audio> seeking in Safari)");
    log(info.chainOk, "chain verifies with the audio hash inside the seal");
  }
} finally {
  await browser.close();
}
