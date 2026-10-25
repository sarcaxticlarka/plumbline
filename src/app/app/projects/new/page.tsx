import { ProjectForm } from "@/components/app/ProjectForm";

export const metadata = { title: "New project" };

export default function NewProject() {
  return (
    <div>
      <div className="mx-auto mb-8 max-w-2xl">
        <div className="label">New project</div>
        <h1 className="serif mt-2 text-[clamp(36px,5vw,56px)] leading-none">Set up the record.</h1>
        <p className="mt-3 text-mute">Location powers weather corroboration; notice windows power the clocks. Everything else is just letterhead.</p>
      </div>
      <ProjectForm />
    </div>
  );
}
