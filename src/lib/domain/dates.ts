/** Date-only (YYYY-MM-DD) arithmetic in UTC so notice math is timezone-stable and testable. */

const MS_DAY = 86_400_000;

export const toUtc = (d: string): number => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};

export const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const addDays = (d: string, n: number): string => fromUtc(toUtc(d) + n * MS_DAY);

/** Whole days from a to b (b - a). */
export const diffDays = (a: string, b: string): number => Math.round((toUtc(b) - toUtc(a)) / MS_DAY);

export const todayLocal = (now = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};

export const formatDate = (d: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  new Date(toUtc(d)).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

export const weekday = (d: string) => formatDate(d, { weekday: "long" });
