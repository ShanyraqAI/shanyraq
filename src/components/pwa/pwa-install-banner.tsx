"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { usePwaInstall } from "@/components/pwa/use-pwa-install";
import { InstallGuideSheet } from "@/components/pwa/install-guide-sheet";

const DISMISS_KEY = "shanyraq-install-dismissed-at";
const DISMISS_DAYS = 14;

function recentlyDismissed() {
  const value = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
  return Date.now() - value < DISMISS_DAYS * 86_400_000;
}

export function PwaInstallBanner({ locale }: { locale: "ru" | "kk" }) {
  const kk = locale === "kk";
  const { ready, platform, standalone, prompt, promptInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!ready || standalone || platform === "other" || recentlyDismissed()) return;
    const timer = window.setTimeout(() => setVisible(true), 1500);
    return () => window.clearTimeout(timer);
  }, [ready, standalone, platform]);

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  async function install() {
    if (prompt) {
      if (await promptInstall()) setVisible(false);
      return;
    }
    setGuideOpen(true);
  }

  return (
    <>
      {visible ? (
        <div className="fixed inset-x-3 bottom-[calc(4.75rem+max(env(safe-area-inset-bottom),5px))] z-40 mx-auto max-w-[430px] animate-in fade-in slide-in-from-bottom-4 lg:hidden" role="region" aria-label={kk ? "Қолданбаны орнату" : "Установка приложения"}>
          <div className="flex items-center gap-3 rounded-2xl bg-[#193e30] p-3 text-white shadow-xl shadow-emerald-950/25">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/shanyraq-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold">{kk ? "Shanyraq қолданбасын орнатыңыз" : "Установите приложение Shanyraq"}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-white/70">{kk ? "Басты экраннан бір түрту, интернетсіз де жұмыс істейді" : "Открывается в одно касание и работает без интернета"}</p>
            </div>
            <button type="button" onClick={() => void install()} className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[11px] font-extrabold text-[#087761]">{kk ? "Орнату" : "Установить"}</button>
            <button type="button" onClick={dismiss} aria-label={kk ? "Жабу" : "Закрыть"} className="-mr-1 grid size-7 shrink-0 place-items-center rounded-full text-white/60"><X className="size-4" /></button>
          </div>
        </div>
      ) : null}
      <InstallGuideSheet open={guideOpen} onOpenChange={(open) => { setGuideOpen(open); if (!open) dismiss(); }} platform={platform} locale={locale} />
    </>
  );
}
