import type { CauseT, PartyT } from "@/lib/domain/schema";

export const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, eighteen: 18, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, "a dozen": 12, dozen: 12,
};

export const NUM_RE = "(\\d{1,3}|a dozen|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|eighteen|twenty|thirty|forty|fifty)";

export const toNumber = (s: string): number => {
  const k = s.toLowerCase();
  return k in NUMBER_WORDS ? NUMBER_WORDS[k] : Number(k);
};

export interface TradeDef {
  name: string;
  re: string;
}

export const TRADES: TradeDef[] = [
  { name: "Concrete", re: "concrete (?:crew|finishers?|guys|masons?)|finishers?|pour crew|flatwork crew" },
  { name: "Ironworkers", re: "ironworkers?|iron workers?|rebar (?:crew|guys|setters?)|rodbusters?" },
  { name: "Steel erectors", re: "steel erectors?|erectors?|steel crew|steel guys" },
  { name: "Carpenters", re: "carpenters?|framers?|framing crew|form(?:work)? crew|carpentry" },
  { name: "Electricians", re: "electricians?|electrical crew|electrical guys|sparkies" },
  { name: "Plumbers", re: "plumbers?|pipefitters?|plumbing crew" },
  { name: "HVAC", re: "hvac(?: crew| guys| techs?)?|sheet ?metal(?: crew| guys| workers?)?|mechanical crew|duct(?:work)? crew" },
  { name: "Drywall", re: "drywall(?:ers| crew| guys)?|tapers?" },
  { name: "Masons", re: "masons?|bricklayers?|block ?layers?|masonry crew" },
  { name: "Welders", re: "welders?" },
  { name: "Roofers", re: "roofers?|roofing crew" },
  { name: "Glaziers", re: "glaziers?|glazing crew|curtain ?wall (?:crew|guys|installers?)" },
  { name: "Painters", re: "painters?|paint crew" },
  { name: "Operators", re: "(?:equipment |crane |excavator )?operators?|excavation crew|dirt crew" },
  { name: "Fire protection", re: "sprinkler fitters?|fire protection (?:crew|guys)|sprinkler crew" },
  { name: "Insulators", re: "insulators?|insulation crew" },
  { name: "Flooring", re: "flooring (?:crew|guys)|tile setters?|tilers?" },
  { name: "Waterproofing", re: "waterproofers?|waterproofing crew" },
  { name: "Demo", re: "demo(?:lition)? (?:crew|guys)" },
  { name: "Survey", re: "surveyors?|survey crew" },
  { name: "Landscaping", re: "landscapers?|landscape crew" },
  { name: "Elevator", re: "elevator (?:mechanics?|crew|guys)" },
  { name: "Laborers", re: "laborers?|labourers?|general labou?r|laborer crew" },
];

export const EQUIPMENT: { name: string; re: string }[] = [
  { name: "Tower crane", re: "tower crane" },
  { name: "Mobile crane", re: "mobile crane|crawler crane|truck crane" },
  { name: "Crane", re: "crane" },
  { name: "Excavator", re: "excavators?|trackhoe" },
  { name: "Loader", re: "loaders?|front[- ]end loader" },
  { name: "Backhoe", re: "backhoe" },
  { name: "Dozer", re: "dozer|bulldozer" },
  { name: "Skid steer", re: "skid steers?|bobcat" },
  { name: "Telehandler", re: "telehandlers?|lull" },
  { name: "Boom lift", re: "boom lifts?|man ?lifts?" },
  { name: "Scissor lift", re: "scissor lifts?" },
  { name: "Concrete pump", re: "concrete pump|pump truck|boom pump" },
  { name: "Forklift", re: "forklift" },
  { name: "Generator", re: "generator" },
  { name: "Hoist", re: "hoist" },
  { name: "Dump truck", re: "dump trucks?" },
  { name: "Roller", re: "roller|compactor" },
];

/** Activities that show up as "what was affected" even when no trade is named. */
export const ACTIVITIES = [
  "pour", "lift", "hoist", "deck", "framing", "rebar", "excavation", "backfill", "drywall", "roofing",
  "welding", "masonry", "curtain wall", "glazing", "paving", "waterproofing", "steel erection", "formwork",
  "rough-in", "tie-in", "sheathing", "stripping",
];

export const AREA_RE =
  /\b(?:level|floor|lvl)\s?(?:\d+|[a-z])\b|\bL\d{1,2}\b|\b(?:sub-?basement|basement|rooftop|roof|penthouse|podium|garage|lobby|mezzanine|stair(?:well)?\s?[a-z0-9]+|elevator pit|elevator shaft|slab on grade|footings?|foundation walls?)\b|\bgrid(?:line)?s?\s[a-z]\d*(?:\s?[-–to]+\s?[a-z]?\d+)?\b|\b(?:zone|area|building|bldg|wing|tower|unit)\s[a-z0-9]+\b/i;

export const WORK_VERBS =
  "poured|placed|installed|set|framed|erected|hung|pulled|ran|stripped|formed|tied|finished|excavated|backfilled|compacted|welded|bolted|taped|mudded|sanded|primed|painted|sheathed|insulated|waterproofed|tested|roughed[- ]in|rough[- ]in|trimmed|graded|demoed|demolished|stressed|grouted|laid|stacked|hoisted|lifted|completed|started|continued|worked on|working on|made progress|drilled|cored|sawcut|saw cut|layout|laid out|set up|mobilized|cleaned";

/** Priority-ordered cause detectors for text windows. */
export const CAUSE_PATTERNS: [CauseT, RegExp][] = [
  ["weather", /\b(rain(?:ed|ing|y)?|storm|snow(?:ed|ing)?|sleet|wind(?:y|s)?|gusts?|lightning|freez(?:e|ing)|frost|ice|icy|extreme heat|heat advisory|flood(?:ed|ing)?|hail|tornado|hurricane|downpour|weather)\b/i],
  ["utility", /\b(utility|power company|gas company|water main|con ?ed|transformer|utility locate|energi[sz]e|energization)\b/i],
  ["inspection", /\b(inspect(?:ion|or)|permit|code official|special inspector|hold point|building department|fire marshal|city (?:hasn'?t|didn'?t|won'?t|rejected|failed))\b/i],
  ["material", /\b(deliver(?:y|ies|ed)|shipment|backorder|back[- ]order|supplier|vendor|fabricator|truck (?:never|didn'?t|hasn'?t)|didn'?t arrive|never arrived|not here|material(?:s)? (?:late|not|didn'?t))\b/i],
  ["design", /\b(rfi|drawings?|clarification|architect|engineer(?: of record)?|design(?:er)?|conflict(?:s|ing)?|clash(?:es)?|shop drawings?|submittal|spec(?:ification)?s?|detail (?:is|isn'?t|doesn'?t|missing|not)|asi)\b/i],
  ["owner", /\b(owner(?:'s rep)?|client|owner'?s rep)\b/i],
  ["access", /\b(no access|access|blocked|locked|couldn'?t get in|laydown|staging area|elevator was|hoist was|area wasn'?t (?:ready|available|released))\b/i],
  ["equipment", /\b(broke(?: down)?|broken|breakdown|hydraulic|flat tire|out of service|mechanical (?:issue|problem|failure))\b/i],
  ["subcontractor", /\b(no[- ]show|didn'?t show|never showed|short(?:-| )?handed|short (?:crew|manpower|on (?:men|manpower))|understaffed|manpower issue|sub(?:contractor)? (?:didn'?t|never|was|is))\b/i],
];

export const PARTY_NOUNS: [PartyT, string][] = [
  ["authority", "city|inspector|building department|code official|fire marshal|permit office|county|dot"],
  ["utility", "utility|power company|gas company|water department|con ?ed|electric company"],
  ["architect", "architect|engineer|designer|eor|aor|design team"],
  ["owner", "owner(?:'s rep)?|client|owner'?s rep|developer"],
  ["supplier", "supplier|vendor|manufacturer|distributor|fabricator|yard|rental company"],
  ["subcontractor", "sub(?:contractor)?|electrical sub|plumbing sub|mechanical sub|framing sub|drywall sub|concrete sub"],
];

export const CAUSE_TITLES: Record<CauseT, string> = {
  weather: "Weather delay",
  design: "Design / RFI delay",
  owner: "Owner-caused delay",
  inspection: "Inspection delay",
  material: "Material delivery delay",
  utility: "Utility delay",
  subcontractor: "Sub manpower delay",
  differing_condition: "Differing site condition",
  scope_change: "Scope change",
  access: "Access delay",
  equipment: "Equipment breakdown",
  other: "Delay",
};
