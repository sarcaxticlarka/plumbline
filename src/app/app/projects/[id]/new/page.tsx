import { notFound } from "next/navigation";
import * as repo from "@/lib/db/repo";
import { todayLocal } from "@/lib/domain/dates";
import { Composer } from "@/components/composer/Composer";
import { getServerEngine } from "@/lib/engine";

export const metadata = { title: "New entry" };

export default async function NewEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = repo.getProject(id);
  if (!project) notFound();
  return <Composer project={{ id: project.id, name: project.name, rules: project.rules }} today={todayLocal()} serverEngine={getServerEngine()} />;
}
