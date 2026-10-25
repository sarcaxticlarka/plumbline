import { pageProject } from "@/lib/auth/guards";
import { todayLocal } from "@/lib/domain/dates";
import { Composer } from "@/components/composer/Composer";
import { getServerEngine } from "@/lib/engine";

export const metadata = { title: "New entry" };

export default async function NewEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, user } = await pageProject(id, "log.create");
  return <Composer project={{ id: project.id, name: project.name, rules: project.rules }} today={todayLocal()} serverEngine={getServerEngine()} userName={user.name} />;
}
