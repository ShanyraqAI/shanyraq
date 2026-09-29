"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Dashboard screen failed", { digest: error.digest }); }, [error]);
  return <main className="grid min-h-[70vh] place-items-center bg-[#f7f8f5] p-4"><section className="w-full max-w-md rounded-[28px] border border-[#e8ede7] bg-white p-7 text-center shadow-xl shadow-[#154e3b]/10"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff2e8] text-[#b7662b]"><AlertTriangle className="size-7" /></span><h1 className="mt-5 text-xl font-extrabold text-[#26382f]">Не удалось открыть рабочее пространство</h1><p className="mt-2 text-sm leading-6 text-[#839087]">Попробуйте загрузить страницу ещё раз. Если ошибка повторится, ваши данные останутся сохранены.</p><Button type="button" onClick={reset} className="mt-6 h-12 w-full rounded-xl bg-[#087f68] font-bold hover:bg-[#066b57]"><RefreshCw className="mr-2 size-4" />Повторить загрузку</Button><Link href="/dashboard" className="mt-4 inline-block text-xs font-semibold text-[#688076] hover:text-[#087f68]">Обзор</Link></section></main>;
}
