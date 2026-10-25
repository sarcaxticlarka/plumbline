import { getServerEngine } from "@/lib/engine";
import { pageUser } from "@/lib/auth/guards";
import { portfolio } from "@/lib/services";
import { MobileBar, SideNav } from "@/components/app/SideNav";
import { SyncBanner } from "@/components/app/SyncBanner";
import { PwaRegister } from "@/components/app/PwaRegister";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser();
  const all = await portfolio(undefined, user.id);
  const projects = all.map((o) => ({ id: o.project.id, name: o.project.name, intact: o.chain.ok, urgent: o.urgentNotices + o.overdueNotices }));
  const engine = getServerEngine();
  return (
    <div className="flex min-h-screen">
      <SideNav projects={projects} engine={engine} user={{ name: user.name, email: user.email }} />
      <div className="min-w-0 flex-1">
        <MobileBar projects={projects} />
        <SyncBanner />
        <PwaRegister projectIds={projects.map((p) => p.id)} />
        <div className="mx-auto max-w-[1180px] px-5 py-8 md:px-10 md:py-12">{children}</div>
      </div>
    </div>
  );
}
