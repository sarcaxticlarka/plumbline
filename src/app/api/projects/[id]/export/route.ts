import * as repo from "@/lib/db/repo";
import { delayRegisterCsv, noticeDeadlinesIcs, packetMarkdown } from "@/lib/domain/export";
import { fail } from "@/lib/api";

export const dynamic = "force-dynamic";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = repo.getProject(id);
  if (!project) return fail("Project not found", 404);
  const format = new URL(req.url).searchParams.get("format") ?? "csv";
  const events = repo.listEvents(id);

  const send = (body: string, type: string, ext: string) =>
    new Response(body, {
      headers: {
        "content-type": `${type}; charset=utf-8`,
        "content-disposition": `attachment; filename="${slug(project.name)}-${ext}"`,
      },
    });

  if (format === "csv") return send(delayRegisterCsv(events), "text/csv", "delay-register.csv");
  if (format === "ics") return send(noticeDeadlinesIcs(project, events), "text/calendar", "notice-deadlines.ics");
  if (format === "md")
    return send(packetMarkdown(project, events, repo.verifyProjectChain(id), repo.listLogs(id).length), "text/markdown", "record.md");
  return fail("format must be csv, ics or md", 400);
}
