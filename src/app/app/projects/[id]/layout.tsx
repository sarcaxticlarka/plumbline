import { MapPin, Mic, ScrollText } from "lucide-react";
import { overview } from "@/lib/services";
import { integrity } from "@/lib/anchor/service";
import { demoEnabled } from "@/lib/api";
import { pageProject } from "@/lib/auth/guards";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { ChainBadge, IntegrityBanner } from "@/components/app/ChainBadge";
import { ProjectTabs } from "@/components/app/ProjectTabs";
import { LinkButton, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role, project: p } = await pageProject(id);
  const o = overview(id)!;
  const integ = integrity(id);
  return (
    <div>
      <div className="no-print flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="label flex flex-wrap items-center gap-x-4 gap-y-1">
            {p.address && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{p.address}</span>}
            {p.contractRef && <span className="flex items-center gap-1.5"><ScrollText className="h-3 w-3" />{p.contractRef}</span>}
            <span>Notice windows: {p.rules.delayNoticeDays}d delay · {p.rules.changeNoticeDays}d change · {p.rules.differingConditionNoticeDays}d conditions</span>
          </div>
          <h1 className="serif mt-3 text-[clamp(32px,4.4vw,54px)] leading-[1.02]">{p.name}</h1>
          <div className="mt-3"><Pill className="bg-safety-soft text-safety">You: {ROLE_LABEL[role]}</Pill></div>
        </div>
        {can(role, "log.create") && (
          <LinkButton href={`/app/projects/${p.id}/new`} variant="safety" size="lg">
            <Mic className="h-4 w-4" /> Dictate today’s log
          </LinkButton>
        )}
      </div>
      <div className="no-print mt-6">
        <ChainBadge projectId={p.id} integrity={integ} demo={demoEnabled()} canAnchor={can(role, "anchor.create")} canExport={can(role, "export")} />
      </div>
      <div className="mt-7">
        <IntegrityBanner integrity={integ} />
        <ProjectTabs id={p.id} urgent={o.urgentNotices + o.overdueNotices} />
        {children}
      </div>
    </div>
  );
}
