import { notFound } from "next/navigation";
import { CalendarPlus, Table2 } from "lucide-react";
import * as repo from "@/lib/db/repo";
import { sortedNotices } from "@/lib/services";
import { NoticeBoard } from "@/components/app/NoticeBoard";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Notices" };

export default async function Notices({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = repo.getProject(id);
  if (!project) notFound();
  const items = sortedNotices(repo.listEvents(id));
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
        <div className="flex gap-2">
          <a href={`/api/projects/${id}/export?format=ics`} className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-card/60 px-3.5 text-[13px] font-medium hover:border-ink/40"><CalendarPlus className="h-3.5 w-3.5" /> Add deadlines to calendar</a>
          <a href={`/api/projects/${id}/export?format=csv`} className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-card/60 px-3.5 text-[13px] font-medium hover:border-ink/40"><Table2 className="h-3.5 w-3.5" /> Delay register (CSV)</a>
        </div>
      </div>
      <NoticeBoard items={items} />
    </div>
  );
}
