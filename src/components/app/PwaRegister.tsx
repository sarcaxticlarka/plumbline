"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui";

interface InstallEvent extends Event { prompt: () => Promise<void> }

/** Registers the service worker (production only — in dev it would cache stale chunks) and warms the composer pages for offline use. */
export function PwaRegister({ projectIds }: { projectIds: string[] }) {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __pwaPrompt?: InstallEvent }).__pwaPrompt = e as InstallEvent;
      window.dispatchEvent(new Event("plumbline:installable"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(() => {
          // Visiting these once while online is what makes them open with no signal.
          const warm = (u: string) => fetch(u, { headers: { "x-sw-cache": "1" } }).catch(() => {});
          warm("/app");
          projectIds.forEach((id) => { warm(`/app/projects/${id}`); warm(`/app/projects/${id}/new`); });
        })
        .catch(() => {});
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIds.join(",")]);
  return null;
}

export function InstallButton() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const check = () => setReady(Boolean((window as unknown as { __pwaPrompt?: unknown }).__pwaPrompt));
    check();
    window.addEventListener("plumbline:installable", check);
    window.addEventListener("appinstalled", () => setInstalled(true));
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("plumbline:installable", check);
  }, []);
  if (installed) return <span className="font-mono text-[12px] uppercase tracking-[0.05em] text-ok">✓ Installed on this device</span>;
  return (
    <Button
      variant="ghost"
      disabled={!ready}
      onClick={async () => {
        const e = (window as unknown as { __pwaPrompt?: InstallEvent }).__pwaPrompt;
        await e?.prompt();
      }}
      title={ready ? "" : "Your browser offers install from its menu (or this appears once the app is production-built and visited a few times)."}
    >
      <Download className="h-4 w-4" /> Install the app
    </Button>
  );
}
