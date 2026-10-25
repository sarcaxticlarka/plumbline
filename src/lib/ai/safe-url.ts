import "server-only";
import dns from "node:dns/promises";
import net from "node:net";

/**
 * A user-supplied base URL makes our server fetch an arbitrary address, which is a classic SSRF vector
 * (cloud metadata endpoints, internal services). In production we require https and refuse any host that
 * resolves to a private, loopback or link-local address. Self-hosters can opt out for local models (Ollama).
 */
export class UnsafeUrlError extends Error {}

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  return true;
}

export async function assertSafeBaseUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UnsafeUrlError("The API base URL isn’t a valid URL.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new UnsafeUrlError("The API base URL must start with https://");
  if (u.username || u.password) throw new UnsafeUrlError("Don’t put credentials in the URL — use the API key field.");

  const strict = process.env.NODE_ENV === "production" && process.env.PLUMBLINE_ALLOW_PRIVATE_URLS !== "1";
  if (!strict) return u;

  if (u.protocol !== "https:") throw new UnsafeUrlError("On the hosted app the API base URL must use https://");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new UnsafeUrlError("Couldn’t resolve that host.");
  if (addrs.some((a) => isPrivateAddress(a.address)))
    throw new UnsafeUrlError("That address is private or internal. Hosted Plumbline can only reach public APIs — self-host to use a local model.");
  return u;
}
