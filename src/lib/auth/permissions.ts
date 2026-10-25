/** Pure, shared by server guards and UI (to hide what a role can't do). */
export const ROLES = ["superintendent", "pm", "claims_reviewer", "owner_rep"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  superintendent: "Superintendent",
  pm: "Project manager",
  claims_reviewer: "Claims reviewer",
  owner_rep: "Owner’s rep (read-only)",
};

export const ROLE_BLURB: Record<Role, string> = {
  superintendent: "Dictates and seals daily logs, drafts notices, marks them sent.",
  pm: "Everything a superintendent does, plus sending notices, anchoring the chain and managing the team.",
  claims_reviewer: "Reads everything, exports packets, anchors the chain and sends notices. Can’t add logs.",
  owner_rep: "Read-only view of the logbook, notices and claim packet.",
};

export type Action =
  | "project.read"
  | "log.create"
  | "notice.manage" // draft letters, mark sent / waived
  | "notice.send" // email a notice from the app
  | "anchor.create"
  | "team.manage"
  | "export";

const MATRIX: Record<Role, readonly Action[]> = {
  superintendent: ["project.read", "log.create", "notice.manage", "export"],
  pm: ["project.read", "log.create", "notice.manage", "notice.send", "anchor.create", "team.manage", "export"],
  claims_reviewer: ["project.read", "notice.manage", "notice.send", "anchor.create", "export"],
  owner_rep: ["project.read"],
};

export const can = (role: Role | null | undefined, action: Action): boolean => !!role && MATRIX[role].includes(action);
export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);
