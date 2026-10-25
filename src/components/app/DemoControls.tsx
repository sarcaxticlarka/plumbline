"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";

export function ResetDemo() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/demo/reset", { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
    >
      <RotateCcw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Reset demo data
    </Button>
  );
}
