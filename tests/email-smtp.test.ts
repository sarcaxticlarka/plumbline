import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import net from "node:net";
import type { AddressInfo } from "node:net";

/** A just-enough SMTP server: lets us prove the real SMTP path and the receipt it yields, with no external service. */
describe("SMTP delivery (against a local SMTP server)", () => {
  let server: net.Server;
  let port = 0;
  const received: { from?: string; rcpts: string[]; data: string }[] = [];

  beforeAll(async () => {
    server = net.createServer((sock) => {
      const msg = { rcpts: [] as string[], data: "" } as { from?: string; rcpts: string[]; data: string };
      let inData = false;
      let buf = "";
      sock.write("220 test.local ESMTP\r\n");
      sock.on("data", (chunk) => {
        buf += chunk.toString();
        let i: number;
        while ((i = buf.indexOf("\r\n")) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (inData) {
            if (line === ".") { inData = false; received.push(msg); sock.write("250 2.0.0 Ok: queued as TESTQ123\r\n"); }
            else msg.data += line + "\n";
            continue;
          }
          const u = line.toUpperCase();
          if (u.startsWith("EHLO") || u.startsWith("HELO")) sock.write("250 test.local\r\n");
          else if (u.startsWith("MAIL FROM")) { msg.from = line; sock.write("250 2.1.0 Ok\r\n"); }
          else if (u.startsWith("RCPT TO")) { msg.rcpts.push(line.replace(/^RCPT TO:\s*<?|>?$/gi, "")); sock.write("250 2.1.5 Ok\r\n"); }
          else if (u === "DATA") { inData = true; sock.write("354 End data with <CR><LF>.<CR><LF>\r\n"); }
          else if (u.startsWith("QUIT")) { sock.write("221 Bye\r\n"); sock.end(); }
          else sock.write("250 Ok\r\n");
        }
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise((r) => server.close(() => r(null))));

  it("sends, and returns accepted recipients, the server's reply and a message id", async () => {
    vi.stubEnv("PLUMBLINE_SMTP_URL", `smtp://127.0.0.1:${port}`);
    vi.stubEnv("PLUMBLINE_FROM", "Plumbline <notices@northline.test>");
    const { sendMail, mailMode } = await import("@/lib/email");
    expect(mailMode()).toBe("smtp");
    const r = await sendMail({ to: ["rep@harborpoint.test"], cc: ["me@northline.test"], subject: "Notice of Delay — Wind", text: "Written notice that on October 22 the crane was shut down.", replyTo: "dev@northline.test" });
    expect(r.status).toBe("sent");
    expect(r.provider).toBe("smtp");
    expect(r.accepted.sort()).toEqual(["me@northline.test", "rep@harborpoint.test"]);
    expect(r.response).toMatch(/queued as TESTQ123/);
    expect(r.messageId).toMatch(/^<.+@.+>$/);
    expect(received).toHaveLength(1);
    expect(received[0].data).toMatch(/^Subject: .*Notice/m); // non-ASCII subjects are RFC 2047-encoded
    expect(received[0].data).toContain("crane was shut down");
    vi.unstubAllEnvs();
  });

  it("reports an unreachable server as failed instead of pretending it was sent", async () => {
    vi.stubEnv("PLUMBLINE_SMTP_URL", "smtp://127.0.0.1:9"); // nothing listens on the discard port
    const { sendMail } = await import("@/lib/email");
    const r = await sendMail({ to: ["rep@harborpoint.test"], subject: "Notice", text: "body" });
    expect(r.status).toBe("failed");
    expect(r.accepted).toEqual([]);
    vi.unstubAllEnvs();
  });
});
