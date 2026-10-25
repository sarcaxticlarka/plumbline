import { reseed } from "@/lib/db/seed";
import { demoEnabled, fail, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!demoEnabled()) return fail("Demo mode is disabled.", 403);
  await reseed();
  return json({ ok: true });
}
