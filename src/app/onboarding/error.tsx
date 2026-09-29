"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function OnboardingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Onboarding screen failed", { digest: error.digest }); }, [error]);
  return <main className="grid min-h-dvh place-items-center bg-[#f4f7f4] px-4 py-8"><section className="w-full max-w-md rounded-[28px] bg-white p-7 text-center shadow-xl shadow-[#154e3b]/10 sm:p-9"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff2e8] text-[#b7662b]"><AlertTriangle className="size-7" /></span><p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-[#11816a]">Shanyraq</p><h1 className="mt-2 text-2xl font-extrabold text-[#26382f]">Не получилось загрузить настройку</h1><p className="mt-2 text-sm leading-6 text-[#839087]">Ваши данные не потерялись. Проверьте соединение и попробуйте ещё раз.</p><Button type="button" onClick={reset} className="mt-6 h-12 w-full rounded-xl bg-[#087f68] font-bold hover:bg-[#066b57]"><RefreshCw className="mr-2 size-4" />Повторить</Button><Link href="/dashboard" className="mt-4 inline-block text-xs font-semibold text-[#688076] hover:text-[#087f68]">Вернуться в Shanyraq</Link></section></main>;
}
