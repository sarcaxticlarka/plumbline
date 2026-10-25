/** Same construction as the server: hash(n) = SHA-256(hash(n-1) | content(n)). Real WebCrypto, computed in the browser. */
export const GENESIS = "0".repeat(64);

export async function sha(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function chainHashes(texts: string[]): Promise<string[]> {
  const out: string[] = [];
  let prev = GENESIS;
  for (const t of texts) {
    prev = await sha(`${prev}|${t}`);
    out.push(prev);
  }
  return out;
}
