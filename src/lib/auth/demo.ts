import { createHash } from "node:crypto";
import type { Role } from "./permissions";

/** Demo accounts. Their ids are derived from the email, so every server instance seeds the *same* ids. */
export const DEMO_PASSWORD = "plumbline-demo";
export const DEMO_USERS: { email: string; name: string; role: Role; blurb: string }[] = [
  { email: "maya@northline.test", name: "Maya Chen", role: "superintendent", blurb: "Dictates & seals logs" },
  { email: "dev@northline.test", name: "Dev Patel", role: "pm", blurb: "Sends notices, anchors, manages team" },
  { email: "priya@northline.test", name: "Priya Nair", role: "claims_reviewer", blurb: "Reviews, exports, anchors" },
  { email: "rep@harborpoint.test", name: "Jordan Reyes", role: "owner_rep", blurb: "Read-only owner’s rep" },
];
export const SCHOOL_SUPER = { email: "luis@northline.test", name: "Luis Ortega" };

export const demoUserId = (email: string) => "u" + createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 7);
const DEMO_IDS = new Set([...DEMO_USERS.map((u) => u.email), SCHOOL_SUPER.email].map(demoUserId));
export const isDemoUserId = (id: string) => DEMO_IDS.has(id);
