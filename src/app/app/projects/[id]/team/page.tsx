import { pageProject } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { listInvites, listMembers } from "@/lib/db/repo-auth";
import { TeamPanel } from "@/components/app/TeamPanel";

export const metadata = { title: "Team" };

export default async function Team({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role } = await pageProject(id);
  return <TeamPanel projectId={id} members={listMembers(id)} invites={listInvites(id)} canManage={can(role, "team.manage")} meId={user.id} />;
}
