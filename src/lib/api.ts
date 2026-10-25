import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/http-error";

export const json = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === "number" ? { status: init } : init);

export const fail = (message: string, status = 400, extra?: Record<string, unknown>) =>
  NextResponse.json({ error: message, ...extra }, { status });

export function handle(err: unknown) {
  if (err instanceof HttpError) return fail(err.message, err.status);
  if (err instanceof ZodError) {
    return fail(err.issues[0]?.message ?? "Invalid request", 422, { issues: err.issues.map((i) => ({ path: i.path, message: i.message })) });
  }
  if (err instanceof SyntaxError) return fail("Body must be valid JSON", 400);
  console.error("[plumbline] unhandled", err);
  return fail("Something went wrong on our side.", 500);
}

/** Tiny in-memory token bucket. Good enough to protect a paid model call on a single instance. */
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  b.n += 1;
  return b.n <= limit;
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

export const demoEnabled = () => process.env.PLUMBLINE_DEMO === "1" || (process.env.PLUMBLINE_DEMO !== "0" && process.env.NODE_ENV !== "production");
