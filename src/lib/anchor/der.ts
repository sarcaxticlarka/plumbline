import { createHash, randomBytes } from "node:crypto";

/**
 * Minimal RFC 3161 (Time-Stamp Protocol) client pieces: build a TimeStampReq in DER and read the essentials
 * out of a TimeStampResp. We deliberately don't pull in an ASN.1 library for ~60 lines of DER.
 *
 * What we check in-app: the TSA granted the request, echoed our digest and nonce, and which time it stamped.
 * What we do NOT claim: that the CMS signature chains to a trusted TSA — the stored .tsr can be verified
 * independently with `openssl ts -verify` (see docs/ARCHITECTURE.md).
 */

const SHA256_OID = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);
const NULL = Buffer.from([0x05, 0x00]);

const lenBytes = (n: number) => (n < 0x80 ? [n] : n <= 0xff ? [0x81, n] : [0x82, n >> 8, n & 0xff]);
export const tlv = (tag: number, ...parts: Buffer[]) => {
  const c = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag, ...lenBytes(c.length)]), c]);
};
const derPositiveInt = (b: Buffer) => {
  let v = b;
  while (v.length > 1 && v[0] === 0 && !(v[1] & 0x80)) v = v.subarray(1);
  if (v[0] & 0x80) v = Buffer.concat([Buffer.from([0]), v]);
  return tlv(0x02, v);
};

/** What we ask the TSA to timestamp: a domain-separated digest of the chain head. Anyone can recompute it. */
export const ANCHOR_PREFIX = "plumbline-chain-head:v1";
export const anchorMessage = (projectId: string, seq: number, hash: string) => `${ANCHOR_PREFIX}:${projectId}:${seq}:${hash}`;
export const anchorDigest = (projectId: string, seq: number, hash: string) =>
  createHash("sha256").update(anchorMessage(projectId, seq, hash)).digest();

export function buildTimestampRequest(digest: Buffer, nonce: Buffer = randomBytes(8)): { der: Buffer; nonce: Buffer } {
  const imprint = tlv(0x30, tlv(0x30, SHA256_OID, NULL), tlv(0x04, digest));
  const der = tlv(0x30, tlv(0x02, Buffer.from([1])), imprint, derPositiveInt(nonce), tlv(0x01, Buffer.from([0xff])));
  return { der, nonce };
}

interface Tlv { tag: number; start: number; end: number }
function readTlv(buf: Buffer, off: number): Tlv {
  if (off + 2 > buf.length) throw new Error("Truncated DER");
  let len = buf[off + 1];
  let hdr = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n < 1 || n > 4) throw new Error("Unsupported DER length");
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | buf[off + 2 + i];
    hdr = 2 + n;
  }
  const end = off + hdr + len;
  if (end > buf.length) throw new Error("Truncated DER");
  return { tag: buf[off], start: off + hdr, end };
}

export interface TimestampResult {
  granted: boolean;
  status: number;
  genTime: string | null;
  digestEchoed: boolean;
  nonceEchoed: boolean;
}

export function parseTimestampResponse(buf: Buffer, digest: Buffer, nonce: Buffer): TimestampResult {
  const top = readTlv(buf, 0);
  if (top.tag !== 0x30) throw new Error("Not a TimeStampResp");
  const statusInfo = readTlv(buf, top.start);
  if (statusInfo.tag !== 0x30) throw new Error("Missing PKIStatusInfo");
  const statusInt = readTlv(buf, statusInfo.start);
  if (statusInt.tag !== 0x02) throw new Error("Missing PKIStatus");
  const status = buf[statusInt.start];
  const granted = status === 0 || status === 1;

  const at = buf.indexOf(digest);
  const nonceBytes = (() => {
    let v = nonce;
    while (v.length > 1 && v[0] === 0) v = v.subarray(1);
    return v;
  })();
  let genTime: string | null = null;
  if (at >= 0) {
    const m = buf.subarray(at + digest.length).toString("latin1").match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z/);
    if (m) genTime = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  }
  return { granted, status, genTime, digestEchoed: at >= 0, nonceEchoed: buf.indexOf(nonceBytes) >= 0 };
}
