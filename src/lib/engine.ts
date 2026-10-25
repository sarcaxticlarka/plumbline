import "server-only";
import { DEFAULT_MODEL, hasAnthropicKey } from "@/lib/ai/anthropic";

/** What the server falls back to when a visitor hasn't brought their own key. */
export function getServerEngine(): { live: boolean; label: string } {
  const live = hasAnthropicKey() && process.env.PLUMBLINE_PROVIDER !== "local";
  return { live, label: live ? `Claude · ${process.env.PLUMBLINE_MODEL || DEFAULT_MODEL}` : "Offline engine" };
}
