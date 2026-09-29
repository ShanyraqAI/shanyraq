export default function OnboardingLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f4f7f4] px-4 py-8" role="status" aria-label="Загружаем настройку профиля">
      <div className="w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-[0_24px_70px_-40px_rgba(18,72,56,.35)]">
        <div className="h-1.5 overflow-hidden bg-[#e7f1e9]"><div className="h-full w-1/3 animate-[loading-bar_1.2s_ease-in-out_infinite] rounded-full bg-[#09846a]" /></div>
        <div className="grid min-h-[440px] md:grid-cols-2">
          <div className="flex flex-col justify-between bg-gradient-to-br from-[#0a886d] to-[#075746] p-8"><div className="h-8 w-28 animate-pulse rounded-lg bg-white/20" /><div className="space-y-3"><div className="h-8 w-4/5 animate-pulse rounded-lg bg-white/25" /><div className="h-8 w-3/5 animate-pulse rounded-lg bg-white/20" /><div className="h-4 w-full animate-pulse rounded bg-white/15" /><div className="h-32 rounded-2xl bg-white/10 p-3"><div className="h-full animate-pulse rounded-xl bg-white/10" /></div></div></div>
          <div className="flex flex-col justify-center gap-5 p-8"><div className="h-3 w-20 animate-pulse rounded bg-[#d8e7dd]" /><div className="h-7 w-4/5 animate-pulse rounded-lg bg-[#e8eee9]" /><div className="h-12 animate-pulse rounded-xl bg-[#f0f4f1]" /><div className="h-12 animate-pulse rounded-xl bg-[#f0f4f1]" /><div className="h-12 animate-pulse rounded-xl bg-[#dff0e6]" /><p className="text-center text-xs font-medium text-[#839188]">Готовим ваш профиль…</p></div>
        </div>
      </div>
      <style>{`@keyframes loading-bar { 0% { transform: translateX(-110%); } 100% { transform: translateX(330%); } }`}</style>
    </main>
  );
}
