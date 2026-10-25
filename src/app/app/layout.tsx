import { getServerEngine } from "@/lib/engine";
import { portfolio } from "@/lib/services";
import { MobileBar, SideNav } from "@/components/app/SideNav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const all = await portfolio();
  const projects = all.map((o) => ({ id: o.project.id, name: o.project.name, intact: o.chain.ok, urgent: o.urgentNotices + o.overdueNotices }));
  const engine = getServerEngine();
  return (
    <div className="flex min-h-screen">
      <SideNav projects={projects} engine={engine} />
      <div className="min-w-0 flex-1">
        <MobileBar projects={projects} />
        <div className="mx-auto max-w-[1180px] px-5 py-8 md:px-10 md:py-12">{children}</div>
      </div>
    </div>
  );
}
