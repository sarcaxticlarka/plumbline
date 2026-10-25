import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth/session";
import { demoEnabled } from "@/lib/api";
import { DEMO_USERS, ensureSeed } from "@/lib/db/seed";
import { LoginForm } from "@/components/app/LoginForm";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await sessionUser()) redirect("/app");
  const demo = demoEnabled();
  if (demo) await ensureSeed(); // demo accounts need to exist before someone clicks them
  const { next } = await searchParams;
  return (
    <main className="drawing relative min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1400px] gap-12 px-5 py-8 md:px-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col justify-between">
          <Logo />
          <div className="py-16">
            <div className="label flex items-center gap-2.5"><span className="h-[7px] w-[7px] bg-safety" /> Site access</div>
            <h1 className="cond mt-6 text-[clamp(64px,9vw,150px)]">Who’s<br />on <span className="text-safety">site?</span></h1>
            <p className="mt-6 max-w-[460px] text-[16px] leading-relaxed text-ink-2">
              Superintendents dictate and seal. Project managers send notices and anchor the record. Claims reviewers audit. Owner’s reps read. Every role sees exactly what it should.
            </p>
          </div>
          <div className="label">© Plumbline · not legal advice</div>
        </div>
        <div className="flex items-center"><LoginForm demoUsers={demo ? DEMO_USERS : []} next={next && next.startsWith("/app") ? next : "/app"} /></div>
      </div>
    </main>
  );
}
