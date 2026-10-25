import "server-only";
import * as repo from "./repo";
import * as authRepo from "./repo-auth";
import { hashPassword } from "@/lib/auth/password";
import { DEMO_PASSWORD, DEMO_USERS, SCHOOL_SUPER, demoUserId } from "@/lib/auth/demo";
import { addDays, todayLocal, toUtc } from "@/lib/domain/dates";
import { fetchSiteWeatherRange } from "@/lib/weather";
import { RULE_PRESETS, type WeatherEvidence } from "@/lib/domain/types";

/**
 * Demo data. The seeder asks Open-Meteo for the last three weeks of weather at the site and puts the
 * wind and rain delays on the genuinely windiest and wettest workdays, so the weather corroboration
 * you see in the demo is real measured data, not a canned label.
 */

const HARBOR = { lat: 40.7178, lon: -74.0431 };
const AUTHOR = "Maya Chen";

const T = {
  progressA: `Daily report. Clear and about 61 degrees. We had 14 ironworkers, 9 carpenters from Atlas Framing and 6 laborers on site. Ironworkers tied rebar on level 4 slab, grid B to F, and carpenters set edge forms on level 4. Laborers cleaned up the level 3 deck and stacked stripped forms. Held a toolbox talk on fall protection, no incidents. The special inspector came by and the rebar inspection on level 3 passed. Tomorrow we plan to finish the rebar on level 4 and start layout for the pour.`,
  progressB: `Overcast and 55 degrees. Twelve ironworkers, 10 carpenters and 6 laborers on site. The tower crane flew rebar and forms all day with no issues. Carpenters stripped forms on level 3 and ironworkers finished the level 4 slab rebar. Concrete delivery from Metro Ready Mix arrived on time for the level 3 columns. Toolbox talk on crane signals. No incidents.`,
  wind: `Cloudy and about 50 degrees with strong wind from the west all day. We had 12 ironworkers, 9 carpenters and 5 laborers on site. The tower crane was shut down at nine thirty because of wind gusts and stayed down the rest of the day, lost about six hours of steel and rebar hoisting. Ironworkers and carpenters couldn't get material up to level 4 so we moved them to cleanup and layout on level 3. Toolbox talk on wind and loose material. No incidents.`,
  rain: `It rained steadily from early morning. Eight ironworkers and 6 carpenters on site. We stood down the level 4 pour prep and the crane, lost about five hours of slab work. Carpenters worked inside on level 2 formwork. Ponding on the level 4 deck, we will need to pump it before any rebar inspection. Toolbox talk on slips and wet conditions. No incidents.`,
  rfi: `Mostly sunny and 58 degrees. Twelve ironworkers, 10 carpenters and 6 laborers on site. The architect still hasn't answered RFI 42 on the beam conflict at grid C, so the ironworkers can't set the transfer beam and lost six hours of work on the level 4 east bay. We asked the architect for an answer three times this week. Carpenters kept stripping forms on level 3. Held a toolbox talk on housekeeping, no incidents. Need to follow up with the architect first thing tomorrow.`,
  differing: `Sunny, 63 degrees. Ten laborers and two operators from Keystone Excavation on site. While excavating for the elevator pit the operator hit an unmarked concrete duct bank not shown on the drawings, so we stopped excavation for the rest of the day. We photographed and surveyed the duct bank and notified the owner's rep by phone. The framing crew on level 3 had 8 carpenters setting stud walls. Toolbox talk on excavation safety, no incidents.`,
  change: `Overcast, 54 degrees. Six electricians and 8 carpenters on site. The owner's rep walked the site this morning and asked us to add two more outlets in the lobby, that's extra work and not in the contract. Electricians roughed in the level 2 corridor and carpenters hung sheathing on level 3. The framing inspection on level 3 passed. Toolbox talk on electrical safety, no incidents.`,
  delivery: `Clear, 60 degrees. Eight carpenters, six laborers and four drywall installers on site. The supplier was late on the drywall delivery and the truck didn't show until three in the afternoon, so the drywall crew stood around and we lost five hours of hanging. Carpenters kept framing level 3. Toolbox talk on material handling. No incidents.`,
  pour: `Clear and 57 degrees. 14 ironworkers, 10 carpenters and 6 laborers on site. 12 concrete finishers from Metro Ready Mix placed the level 4 slab, about 180 yards, and finished by four. Laborers stripped forms and cleaned up. Toolbox talk on concrete placement, no incidents. The city inspector visited and the post-pour walkthrough was fine.`,
};

export { DEMO_PASSWORD, DEMO_USERS } from "@/lib/auth/demo";

async function ensureUser(email: string, name: string) {
  const existing = authRepo.getUserByEmail(email);
  if (existing) return { id: existing.id, email, name: existing.name };
  return authRepo.createUser(email, name, await hashPassword(DEMO_PASSWORD), demoUserId(email));
}

let seeding: Promise<void> | null = null;

export function ensureSeed(): Promise<void> {
  if (process.env.PLUMBLINE_SEED === "0" || repo.countProjects() > 0) return Promise.resolve();
  seeding ??= seed().finally(() => {
    seeding = null;
  });
  return seeding;
}

export async function reseed() {
  repo.wipeAll();
  await seed();
}

const isWorkday = (d: string) => {
  const dow = new Date(toUtc(d)).getUTCDay();
  return dow >= 1 && dow <= 5;
};

async function seed() {
  const { sealLog } = await import("@/lib/services"); // lazy: services imports this module
  const today = todayLocal();
  const days: string[] = [];
  for (let i = 15; i >= 1; i--) {
    const d = addDays(today, -i);
    if (isWorkday(d)) days.push(d);
  }
  const use = days.slice(-10);

  const wx = await fetchSiteWeatherRange(HARBOR.lat, HARBOR.lon, use[0], use[use.length - 1]);
  const get = (d: string): WeatherEvidence | null => wx.get(d) ?? null;

  // Real wind / rain days (fall back to fixed positions if the weather service is unreachable).
  const byWind = [...use].sort((a, b) => (get(b)?.windMaxKmh ?? -1) - (get(a)?.windMaxKmh ?? -1));
  const windDay = (wx.size ? byWind[0] : use[2]) as string;
  const byRain = [...use].filter((d) => d !== windDay).sort((a, b) => (get(b)?.precipitationMm ?? -1) - (get(a)?.precipitationMm ?? -1));
  const rainDay = (wx.size ? byRain[0] : use[6]) as string;

  const plan: Record<string, string> = { [windDay]: T.wind, [rainDay]: T.rain };
  const rest = use.filter((d) => d !== windDay && d !== rainDay);
  const order = [T.progressA, T.progressB, T.rfi, T.differing, T.change, T.delivery, T.progressB, T.pour];
  rest.forEach((d, i) => (plan[d] = order[i % order.length]));

  const people = new Map<string, { id: string }>();
  for (const u of DEMO_USERS) people.set(u.email, await ensureUser(u.email, u.name));
  people.set(SCHOOL_SUPER.email, await ensureUser(SCHOOL_SUPER.email, SCHOOL_SUPER.name));

  const project = repo.insertProject({
    id: "harbor-point",
    ownerName: "Jordan Reyes",
    ownerEmail: "rep@harborpoint.test",
    name: "Harbor Point Tower — Podium & Levels 3–6",
    address: "Jersey City, NJ",
    client: "Harbor Point Development LLC",
    contractor: "Northline Builders",
    contractRef: "AIA A201-2017 / Agreement dated 2026-02-14",
    lat: HARBOR.lat,
    lon: HARBOR.lon,
    rules: RULE_PRESETS.tight7.rules,
  });

  for (const u of DEMO_USERS) authRepo.setMember(project.id, people.get(u.email)!.id, u.role);

  for (const d of use) {
    const lateByDays = d === use[4] ? 3 : 0; // one entry written up three days late: shows the contemporaneity check
    await sealLog(
      project.id,
      { logDate: d, author: AUTHOR, authorId: people.get("maya@northline.test")!.id, transcript: plan[d], source: "voice", attachments: [], addendumOf: null },
      { createdAt: `${addDays(d, lateByDays)}T14:30:00.000Z`, forceLocal: true, weather: get(d), id: `${project.id}-${String(use.indexOf(d) + 1).padStart(2, "0")}` },
    );
  }

  // Mark the wind and rain notices as already sent, leave the rest to show the clock at work.
  for (const e of repo.listEvents(project.id)) {
    if (e.kind === "delay" && e.cause === "weather") repo.upsertNotice(e.id, project.id, "sent", addDays(e.occurredOn, 1));
  }

  /* second, quieter project */
  // The owner's rep was emailed the chain head part-way through (demo record): this is what exposes a history rewrite.
  const anchorAt = repo.listLogs(project.id).find((l) => l.seq === 7);
  if (anchorAt) {
    repo.insertAnchor({
      projectId: project.id,
      headSeq: anchorAt.seq,
      headHash: anchorAt.hash,
      kind: "email",
      status: "recorded",
      detail: { to: "rep@harborpoint.test", note: "Daily chain head emailed to the owner’s rep (demo record).", demo: true },
      createdAt: `${anchorAt.content.logDate}T22:00:00.000Z`,
    });
  }

  const school = repo.insertProject({
    id: "riverside-elementary",
    ownerName: "Newark Public Schools",
    ownerEmail: "facilities@npsd.test",
    name: "Riverside Elementary — Gym Addition",
    address: "Newark, NJ",
    client: "Newark Public Schools",
    contractor: "Northline Builders",
    contractRef: "Public works contract PW-2026-118",
    lat: 40.7357,
    lon: -74.1724,
    rules: RULE_PRESETS.publicWorks10.rules,
  });
  for (const u of DEMO_USERS.filter((x) => x.role === "pm" || x.role === "claims_reviewer")) authRepo.setMember(school.id, people.get(u.email)!.id, u.role);
  authRepo.setMember(school.id, people.get(SCHOOL_SUPER.email)!.id, "superintendent");
  const sDays = use.slice(-4);
  const sPlan = [T.progressA, T.pour, T.rfi, T.progressB];
  for (let i = 0; i < sDays.length; i++) {
    await sealLog(
      school.id,
      { logDate: sDays[i], author: "Luis Ortega", authorId: people.get(SCHOOL_SUPER.email)!.id, transcript: sPlan[i], source: "text", attachments: [], addendumOf: null },
      { createdAt: `${sDays[i]}T14:30:00.000Z`, forceLocal: true, weather: null, id: `${school.id}-${String(i + 1).padStart(2, "0")}` },
    );
  }
}
