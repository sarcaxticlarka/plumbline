import { CalendarPlus, Table2 } from "lucide-react";
import * as repo from "@/lib/db/repo";
import { sortedNotices } from "@/lib/services";
import { pageProject } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { mailMode } from "@/lib/email";
import { NoticeBoard, type Receipt } from "@/components/app/NoticeBoard";

export const metadata = { title: "Notices" };

export default async function Notices({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, project } = await pageProject(id);
  const items = sortedNotices(repo.listEvents(id));
  const receipts: Record<string, Receipt> = {};
  for (const e of repo.listEmails(id)) {
    if (e.kind === "notice" && e.eventId && !receipts[e.eventId]) {
      receipts[e.eventId] = { id: e.id, status: e.status, to: e.to, provider: e.provider, messageId: e.messageId, response: e.response, bodySha256: e.bodySha256, createdAt: e.createdAt };
    }
  }
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="serif text-[34px] leading-none">Notice clock</h2>
          <p className="mt-2 text-[14.5px] text-mute">
            Every delay, change and differing condition starts a countdown from this project’s notice windows ({project.rules.delayNoticeDays}/{project.rules.changeNoticeDays}/{project.rules.differingConditionNoticeDays} days).
            Verify the windows against your contract — they are your responsibility to set.
          </p>
        </div>
        {can(role, "export") && (
          <div className="flex gap-2">
            <a href={`/api/projects/${id}/export?format=ics`} className="inline-flex h-8 items-center gap-2 border border-line bg-card/60 px-3.5 font-mono text-[11px] uppercase tracking-[0.05em] hover:border-ink/40"><CalendarPlus className="h-3.5 w-3.5" /> Add deadlines to calendar</a>
            <a href={`/api/projects/${id}/export?format=csv`} className="inline-flex h-8 items-center gap-2 border border-line bg-card/60 px-3.5 font-mono text-[11px] uppercase tracking-[0.05em] hover:border-ink/40"><Table2 className="h-3.5 w-3.5" /> Delay register (CSV)</a>
          </div>
        )}
      </div>
      <NoticeBoard items={items} ownerEmail={project.ownerEmail} canManage={can(role, "notice.manage")} canSend={can(role, "notice.send")} mailMode={mailMode()} receipts={receipts} />
    </div>
  );
}
