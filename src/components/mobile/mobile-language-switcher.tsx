"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/lib/locale";
import { setAppLocaleAction } from "@/server/actions/locale";

export function MobileLanguageSwitcher({ locale }: { locale: AppLocale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: AppLocale) {
    if (next === locale) return;
    startTransition(async () => {
      const result = await setAppLocaleAction(next);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="sh-mobile-card flex items-center gap-3 p-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e5f3ef] text-[#07866b]"><Languages className="size-4" /></span>
      <div className="grid flex-1 grid-cols-2 rounded-xl bg-[#f0f1eb] p-1">
        {(["ru", "kk"] as const).map((item) => (
          <button key={item} type="button" disabled={pending} onClick={() => change(item)} className={cn("min-h-9 rounded-lg text-xs font-bold text-[#8a918a]", locale === item && "bg-white text-[#087d66] shadow-sm")}>
            {item === "ru" ? "Русский" : "Қазақша"}
          </button>
        ))}
      </div>
    </div>
  );
}
