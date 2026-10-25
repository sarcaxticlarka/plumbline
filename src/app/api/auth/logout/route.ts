import { endSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/guards";
import { handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await endSession();
    return json({ ok: true });
  } catch (e) {
    return handle(e);
  }
}
