"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  return (
    <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center bg-safety font-mono text-[13px] font-bold text-on-safety">{name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium">{name}</div>
        <div className="truncate text-[11.5px] text-mute">{email}</div>
      </div>
      <button
        aria-label="Sign out"
        title="Sign out"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          navigator.serviceWorker?.controller?.postMessage({ type: "clear" }); // forget cached authenticated pages
          router.push("/login");
          router.refresh();
        }}
        className="grid h-8 w-8 place-items-center border border-line text-mute transition-colors hover:border-ink/50 hover:text-ink"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
