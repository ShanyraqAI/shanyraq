"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { usePwaInstall } from "@/components/pwa/use-pwa-install";
import { InstallGuideSheet } from "@/components/pwa/install-guide-sheet";

export function PwaInstallButton({ title, hint, locale }: { title: string; hint: string; locale: "ru" | "kk" }) {
  const { ready, platform, standalone, prompt, promptInstall } = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (!ready || standalone) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (prompt ? void promptInstall() : setGuideOpen(true))}
        className="flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-3.5 text-left text-primary-foreground shadow-sm"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15"><Download className="size-5" /></span>
        <span><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs text-primary-foreground/70">{hint}</span></span>
      </button>
      <InstallGuideSheet open={guideOpen} onOpenChange={setGuideOpen} platform={platform} locale={locale} />
    </>
  );
}
