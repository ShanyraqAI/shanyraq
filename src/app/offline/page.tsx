import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f7f7f2] p-6 text-[#263d33]">
      <section className="w-full max-w-sm rounded-3xl border border-[#dfe3d6] bg-white p-7 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#edf0e6] text-[#193e30]"><WifiOff className="size-6" /></span>
        <h1 className="mt-5 text-xl font-semibold">Нет подключения</h1>
        <p className="mt-2 text-sm leading-6 text-[#626f5b]">Shanyraq Mobile сохранит безопасный вход в приложение. Подключитесь к сети, чтобы загрузить актуальные брони и синхронизацию каналов.</p>
        <Link href="/dashboard" className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#193e30] px-4 text-sm font-semibold text-white"><RefreshCw className="size-4" />Повторить</Link>
        <p className="mt-4 text-xs text-[#626f5b]">Қосылым жоқ · Желіге қосылып, қайта көріңіз.</p>
      </section>
    </main>
  );
}

