"use client";

import { EllipsisVertical, Share, SquarePlus, Check, WifiOff, Zap } from "lucide-react";
import type { ComponentType } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { InstallPlatform } from "@/components/pwa/use-pwa-install";

type Step = { icon: ComponentType<{ className?: string }>; title: string; hint: string };

function steps(platform: InstallPlatform, kk: boolean): Step[] {
  if (platform === "ios") {
    return kk
      ? [
          { icon: Share, title: "«Бөлісу» батырмасын басыңыз", hint: "Safari-де — экранның төменгі жағында, Chrome-да — мекенжай жолының оң жағында." },
          { icon: SquarePlus, title: "«Басты экранға» таңдаңыз", hint: "Мәзірді төмен қарай айналдырып, «На экран „Домой“» тармағын табыңыз." },
          { icon: Check, title: "«Қосу» батырмасын басыңыз", hint: "Shanyraq белгішесі басты экранда пайда болады." },
        ]
      : [
          { icon: Share, title: "Нажмите «Поделиться»", hint: "В Safari кнопка внизу экрана, в Chrome — справа в адресной строке." },
          { icon: SquarePlus, title: "Выберите «На экран „Домой“»", hint: "Пролистайте меню вниз, если пункта не видно сразу." },
          { icon: Check, title: "Нажмите «Добавить»", hint: "Иконка Shanyraq появится на главном экране." },
        ];
  }
  return kk
    ? [
        { icon: EllipsisVertical, title: "Браузер мәзірін ашыңыз", hint: "Жоғарғы оң жақтағы ⋮ батырмасы." },
        { icon: SquarePlus, title: "«Қолданбаны орнату» таңдаңыз", hint: "Немесе «Басты экранға қосу»." },
        { icon: Check, title: "«Орнату» батырмасын басыңыз", hint: "Shanyraq белгішесі басты экранда пайда болады." },
      ]
    : [
        { icon: EllipsisVertical, title: "Откройте меню браузера", hint: "Кнопка ⋮ в правом верхнем углу." },
        { icon: SquarePlus, title: "Выберите «Установить приложение»", hint: "Или «Добавить на главный экран»." },
        { icon: Check, title: "Подтвердите «Установить»", hint: "Иконка Shanyraq появится на главном экране." },
      ];
}

export function InstallGuideSheet({ open, onOpenChange, platform, locale }: { open: boolean; onOpenChange: (open: boolean) => void; platform: InstallPlatform; locale: "ru" | "kk" }) {
  const kk = locale === "kk";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-0 bg-[#f7f8f5] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6">
        <SheetHeader className="p-0 text-left">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/shanyraq-192.png" alt="" className="size-12 rounded-2xl shadow-sm" />
            <div>
              <SheetTitle className="text-base font-extrabold text-[#24332c]">{kk ? "Shanyraq қолданбасын орнату" : "Установите Shanyraq"}</SheetTitle>
              <SheetDescription className="text-xs text-[#7b847c]">{kk ? "3 қарапайым қадам · 10 секунд" : "3 простых шага · 10 секунд"}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <ol className="space-y-2">
          {steps(platform, kk).map((step, index) => (
            <li key={step.title} className="flex items-start gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-[#e7e9e1]">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e3f3ed] text-[#07866b]"><step.icon className="size-[18px]" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#28362f]"><span className="mr-1 text-[#07866b]">{index + 1}.</span>{step.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-[#7b847c]">{step.hint}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-[#4f5c55]">
          <span className="flex items-center gap-2 rounded-xl bg-[#e3f3ed] px-3 py-2.5"><WifiOff className="size-4 text-[#07866b]" />{kk ? "Интернетсіз жұмыс" : "Работает без интернета"}</span>
          <span className="flex items-center gap-2 rounded-xl bg-[#e3f3ed] px-3 py-2.5"><Zap className="size-4 text-[#07866b]" />{kk ? "Жылдам іске қосу" : "Быстрый запуск"}</span>
        </div>
        <button type="button" onClick={() => onOpenChange(false)} className="min-h-12 w-full rounded-2xl bg-[#07866b] text-sm font-bold text-white">{kk ? "Түсінікті" : "Понятно"}</button>
      </SheetContent>
    </Sheet>
  );
}
