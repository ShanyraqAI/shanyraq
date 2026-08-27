import {
  Hotel,
  CalendarCheck2,
  BedDouble,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Globe2,
  ChevronRight,
  Search,
  Bell,
  ArrowUp,
  ArrowDown,
  Percent,
  ReceiptText,
  CalendarDays,
  Users,
  BarChart3,
  Settings2,
  LogOut,
  Play,
  Star,
} from "lucide-react";

export const metadata = { title: "Design Preview — Shanyraq AI" };

export default function DesignPreviewPage() {
  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#14201E]">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-[10px] bg-[#0E6B5E] text-white">
              <Hotel className="size-4" />
            </div>
            <span className="text-[15px] font-[650] tracking-[-0.02em]">Shanyraq AI</span>
            <span className="hidden sm:inline-flex rounded-full bg-[#0E6B5E]/10 px-2.5 py-1 text-[11px] font-medium tracking-wide text-[#0E6B5E]">
              DESIGN PREVIEW
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <a href="#landing" className="rounded-full px-3 py-1.5 hover:bg-black/[0.06]">Лендинг</a>
            <a href="#register" className="rounded-full px-3 py-1.5 hover:bg-black/[0.06]">Регистрация</a>
            <a href="#dashboard" className="rounded-full bg-[#14201E] px-4 py-1.5 font-medium text-white">Дэшборд</a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] space-y-16 px-6 py-8">
        <header className="max-w-3xl">
          <h1 className="text-[28px] font-[700] tracking-[-0.03em] leading-none sm:text-[34px]">Минималистичный редизайн</h1>
          <p className="mt-3 text-[15px] leading-6 text-[#5A6B67]">
            Три экрана как изображения — лендинг, регистрация и дэшборд. Светлая палитра, много воздуха, тонкие линии, премиальная типографика. Прокрутите — каждый экран в рамке 1280×, готов для скриншота / экспорта в Figma.
          </p>
          <p className="mt-2 text-xs text-[#8A9A96]">Подсказка: откройте <span className="font-mono">/design-preview</span> и сделайте скриншот каждого артборда. Все стили — чистый Tailwind, без новых зависимостей.</p>
        </header>

        {/* ========== 1. LANDING ========== */}
        <section id="landing" className="scroll-mt-20">
          <div className="mb-3 flex items-center gap-3">
            <span className="size-2 rounded-full bg-[#0E6B5E]" />
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#0E6B5E]">01 — Лендинг</h2>
            <span className="h-px flex-1 bg-black/[0.06]" />
            <span className="text-xs text-[#8A9A96]">1280 × 820 · light · minimal</span>
          </div>

          {/* Artboard */}
          <div className="overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_32px_80px_-32px_rgba(20,32,30,0.18),0_1px_0_rgba(0,0,0,0.06)]">
            {/* Landing inner */}
            <div className="bg-[#FFFEFB]">
              {/* Nav */}
              <div className="flex items-center justify-between border-b border-black/[0.06] px-8 py-4">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-[#0E6B5E] text-white"><Hotel className="size-3.5" /></div>
                    <span className="text-sm font-semibold tracking-tight">Shanyraq AI</span>
                  </div>
                  <nav className="hidden items-center gap-6 text-[13px] font-medium text-[#5A6B67] md:flex">
                    <span>Продукт</span><span>Каналы</span><span>Цены</span><span>Контакты</span>
                  </nav>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden text-sm font-medium text-[#5A6B67] sm:inline">Войти</span>
                  <span className="rounded-full bg-[#14201E] px-4 py-2 text-sm font-medium text-white">Начать бесплатно</span>
                </div>
              </div>

              {/* Hero */}
              <div className="grid grid-cols-12 gap-8 px-8 py-10">
                <div className="col-span-6 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 self-start rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium">
                    <span className="size-1.5 rounded-full bg-[#0E6B5E]" /> Канал-менеджер для отелей Казахстана
                  </div>
                  <h3 className="mt-4 text-[42px] font-[700] leading-[0.95] tracking-[-0.04em]">
                    Один отель.<br />
                    <span className="font-[300] italic text-[#0E6B5E]">Все каналы.</span><br />
                    Один экран.
                  </h3>
                  <p className="mt-4 max-w-[44ch] text-[15px] leading-6 text-[#5A6B67]">
                    Управляйте бронированиями, тарифами и доступностью. Синхронизация с Booking.com, Ostrovok и Krisha.kz — без овербукингов.
                  </p>
                  <div className="mt-6 flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#0E6B5E] px-5 py-2.5 text-sm font-semibold text-white">Начать 14 дней бесплатно <ArrowUpRight className="size-4" /></span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium"><Play className="size-3.5" /> Демо 2 мин</span>
                  </div>
                  <div className="mt-6 flex items-center gap-4 text-xs text-[#8A9A96]">
                    <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Без карты</span>
                    <span className="size-1 rounded-full bg-black/15" />
                    <span className="flex items-center gap-1"><Star className="size-3 fill-[#EAB308] text-[#EAB308]" /> 4.9 · 120+ отелей</span>
                  </div>
                </div>

                {/* Dashboard preview mock */}
                <div className="col-span-6">
                  <div className="rounded-[20px] border border-black/[0.08] bg-white p-3 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.25)]">
                    <div className="flex items-center justify-between px-1 pb-3">
                      <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#FF5F57]" /><span className="size-2.5 rounded-full bg-[#FFBD2E]" /><span className="size-2.5 rounded-full bg-[#28CA42]" /></div>
                      <span className="text-[11px] font-medium text-[#8A9A96]">shanyraq.kz — Обзор</span>
                      <span className="text-[11px] text-[#8A9A96]">● Синхронизировано</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { k: "Загрузка", v: "84%", s: "18 из 24 сегодня" },
                        { k: "Выручка MTD", v: "₸ 4.2M", s: "+12% к прошлому мес." },
                        { k: "Свободно", v: "6", s: "4 гостя проживают" },
                      ].map((c) => (
                        <div key={c.k} className="rounded-2xl border border-black/[0.06] bg-[#FCFCF9] p-3">
                          <div className="text-[11px] font-medium tracking-wide text-[#8A9A96]">{c.k}</div>
                          <div className="mt-1 text-lg font-semibold tracking-tight">{c.v}</div>
                          <div className="text-[11px] text-[#8A9A96]">{c.s}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-2xl border border-black/[0.06] bg-[#FCFCF9] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">Бронирования · Сегодня</span>
                        <span className="rounded-full bg-[#0E6B5E] px-2 py-0.5 text-[11px] font-semibold text-white">3 заезда</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {[
                          ["Айдана Серикова", "Люкс 301", "Booking.com", "Подтверждено"],
                          ["Daniyar Kim", "Стандарт 205", "Ostrovok", "Заселён"],
                          ["Coral Family", "Семейный 102", "Прямые", "Ожидает"],
                        ].map((r) => (
                          <div key={r[0]} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs border border-black/[0.04]">
                            <span className="font-medium">{r[0]}</span><span className="text-[#8A9A96]">{r[1]}</span><span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px]">{r[2]}</span><span className="text-[#0E6B5E]">{r[3]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-medium text-[#8A9A96]">
                    <Globe2 className="size-3.5" /> Booking.com · Ostrovok · Krisha.kz · Прямые
                  </div>
                </div>
              </div>

              {/* Feature strip */}
              <div className="grid grid-cols-3 divide-x divide-black/[0.06] border-y border-black/[0.06] bg-white">
                {[
                  { icon: CalendarCheck2, title: "Календарь перетаскиванием", desc: "Недельный таймлайн. Переносите брони мышью — без овербукинга." },
                  { icon: Zap, title: "Синхронизация каналов", desc: "Цены и доступность улетают во все каналы за секунды." },
                  { icon: BarChart3, title: "Отчёты без Excel", desc: "Загрузка, ADR, RevPAR и выручка по каналам." },
                ].map((f) => (
                  <div key={f.title} className="px-8 py-6">
                    <f.icon className="size-4 text-[#0E6B5E]" />
                    <div className="mt-2 text-sm font-semibold">{f.title}</div>
                    <div className="mt-1 text-xs leading-5 text-[#5A6B67]">{f.desc}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between px-8 py-4 text-xs text-[#8A9A96]">
                <span>© 2026 Shanyraq AI · Сделано для отелей Центральной Азии</span>
                <span className="flex items-center gap-2">Договор-оферта · Конфиденциальность <ChevronRight className="size-3" /></span>
              </div>
            </div>
          </div>
        </section>

        {/* ========== 2. REGISTER ========== */}
        <section id="register" className="scroll-mt-20">
          <div className="mb-3 flex items-center gap-3">
            <span className="size-2 rounded-full bg-[#0E6B5E]" />
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#0E6B5E]">02 — Регистрация</h2>
            <span className="h-px flex-1 bg-black/[0.06]" />
            <span className="text-xs text-[#8A9A96]">split · 1280 × 640 · soft premium</span>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_32px_80px_-32px_rgba(20,32,30,0.18)]">
            <div className="grid grid-cols-12 min-h-[540px]">
              {/* Left brand */}
              <div className="col-span-5 flex flex-col justify-between bg-[#14201E] p-8 text-white">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-white text-[#14201E]"><Hotel className="size-4" /></div>
                    <span className="text-sm font-semibold">Shanyraq AI</span>
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/70">Платформа управления отелем</span>
                  </div>
                  <h3 className="mt-10 text-[30px] font-[650] leading-[1.05] tracking-[-0.03em]">
                    Начните управлять<br />
                    <span className="font-light italic text-[#8ED0C3]">отелем за 2 минуты.</span>
                  </h3>
                  <ul className="mt-6 space-y-3 text-sm text-white/75">
                    <li className="flex gap-2"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#8ED0C3]" /> Импорт броней из Booking.com и Ostrovok</li>
                    <li className="flex gap-2"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#8ED0C3]" /> Календарь, тарифы и отчёты в одном месте</li>
                    <li className="flex gap-2"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#8ED0C3]" /> Без карты · отмена в один клик</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                  <div className="flex items-center gap-1 text-[#FFD23F]"><Star className="size-3 fill-[#FFD23F]" /><Star className="size-3 fill-[#FFD23F]" /><Star className="size-3 fill-[#FFD23F]" /><Star className="size-3 fill-[#FFD23F]" /><Star className="size-3 fill-[#FFD23F]" /><span className="ml-1 text-xs font-medium text-white">4.9/5</span></div>
                  <p className="mt-2 text-sm leading-6 text-white/85">“Перешли с таблиц за один вечер. Загрузка выросла на 22% — наконец видим все каналы.”</p>
                  <div className="mt-3 flex items-center gap-2.5">
                    <div className="size-7 rounded-full bg-[#8ED0C3]" />
                    <div className="text-xs leading-none"><div className="font-medium">Алия Н.</div><div className="text-white/60">Aisultan Boutique, Алматы · 24 номера</div></div>
                  </div>
                </div>
              </div>

              {/* Right form */}
              <div className="col-span-7 flex flex-col bg-[#FFFEFB] p-8">
                <div className="mx-auto w-full max-w-[420px]">
                  <div className="text-center">
                    <h4 className="text-[22px] font-semibold tracking-tight">Создать аккаунт</h4>
                    <p className="mt-1 text-sm text-[#5A6B67]">Начните управлять своим отелем за пару минут</p>
                  </div>

                  <div className="mt-6 rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                    <label className="text-[12px] font-medium text-[#14201E]">Имя и фамилия</label>
                    <div className="mt-1.5 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#8A9A96]">Введите имя и фамилию</div>

                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-full bg-[#F1F1EF] p-1">
                      <span className="rounded-full bg-white py-1.5 text-center text-sm font-medium shadow-sm">Email</span>
                      <span className="py-1.5 text-center text-sm font-medium text-[#8A9A96]">Телефон</span>
                    </div>

                    <label className="mt-4 block text-[12px] font-medium">Email</label>
                    <div className="mt-1.5 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#8A9A96]">you@hotel.kz</div>

                    <label className="mt-4 block text-[12px] font-medium">Пароль</label>
                    <div className="mt-1.5 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#8A9A96]">••••••••</div>
                    <div className="mt-1 text-xs text-[#8A9A96]">Минимум 8 символов</div>

                    <div className="mt-5 rounded-full bg-[#0E6B5E] py-3 text-center text-sm font-semibold text-white">Зарегистрироваться</div>

                    <div className="relative my-5 text-center">
                      <span className="relative z-10 bg-white px-3 text-xs uppercase tracking-wide text-[#8A9A96]">или</span>
                      <span className="absolute inset-x-0 top-1/2 h-px bg-black/10" />
                    </div>

                    <div className="flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white py-2.5 text-sm font-medium">
                      <span className="flex size-5 items-center justify-center rounded-full bg-white shadow">G</span> Продолжить с Google
                    </div>

                    <p className="mt-4 text-center text-sm text-[#8A9A96]">Уже есть аккаунт? <span className="font-medium text-[#0E6B5E]">Войти</span></p>
                  </div>

                  <p className="mt-4 text-center text-xs leading-5 text-[#8A9A96]">Регистрируясь, вы соглашаетесь с офертой и политикой конфиденциальности. Демо-данные можно сбросить в любой момент.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== 3. DASHBOARD ========== */}
        <section id="dashboard" className="scroll-mt-20">
          <div className="mb-3 flex items-center gap-3">
            <span className="size-2 rounded-full bg-[#0E6B5E]" />
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#0E6B5E]">03 — Дэшборд</h2>
            <span className="h-px flex-1 bg-black/[0.06]" />
            <span className="text-xs text-[#8A9A96]">app shell · 1280 × 760 · data-dense but airy</span>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_32px_80px_-32px_rgba(20,32,30,0.18)]">
            <div className="flex min-h-[620px]">
              {/* Sidebar */}
              <div className="hidden w-[236px] shrink-0 flex-col border-r border-black/[0.06] bg-[#FCFCF9] lg:flex">
                <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-5 py-4">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-[#0E6B5E] text-white"><Hotel className="size-3.5" /></div>
                  <div className="leading-none"><div className="text-sm font-semibold">Shanyraq AI</div><div className="text-[11px] text-[#8A9A96]">Платформа управления отелем</div></div>
                </div>
                <div className="mx-3 mt-4 rounded-xl border border-black/[0.06] bg-white px-3 py-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[#8A9A96]">Отель</div>
                  <div className="truncate text-sm font-semibold">Aisultan Boutique</div>
                  <div className="text-xs text-[#8A9A96]">Алматы · 24 номера</div>
                </div>
                <nav className="mt-4 flex-1 space-y-1 px-3 text-sm">
                  {[
                    { icon: BarChart3, label: "Обзор", active: true },
                    { icon: CalendarDays, label: "Календарь" },
                    { icon: CalendarCheck2, label: "Бронирования", badge: "8" },
                    { icon: BedDouble, label: "Номера" },
                    { icon: Users, label: "Гости" },
                    { icon: Globe2, label: "Каналы" },
                    { icon: ReceiptText, label: "Отчёты" },
                  ].map((i) => (
                    <div key={i.label} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 font-medium ${i.active ? "bg-[#14201E] text-white" : "text-[#5A6B67] hover:bg-black/[0.04]"}`}>
                      <i.icon className={`size-4 ${i.active ? "text-white" : "text-[#8A9A96]"}`} /> {i.label} {i.badge ? <span className="ml-auto rounded-full bg-[#0E6B5E] px-1.5 py-0.5 text-[11px] font-bold text-white">{i.badge}</span> : null}
                    </div>
                  ))}
                  <div className="pt-3 text-[11px] font-semibold uppercase tracking-widest text-[#8A9A96]">Управление</div>
                  {[
                    { icon: Settings2, label: "Настройки" },
                  ].map((i) => (
                    <div key={i.label} className="flex items-center gap-2.5 rounded-xl px-3 py-2 font-medium text-[#5A6B67]"><i.icon className="size-4 text-[#8A9A96]" /> {i.label}</div>
                  ))}
                </nav>
                <div className="border-t border-black/[0.06] p-3">
                  <div className="flex items-center gap-2.5 rounded-xl border border-black/[0.06] bg-white px-3 py-2.5">
                    <div className="flex size-8 items-center justify-center rounded-full bg-[#0E6B5E]/10 text-xs font-bold text-[#0E6B5E]">АИ</div>
                    <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-sm font-medium">Айсултан И.</div><div className="text-[11px] text-[#8A9A96]">Управляющий</div></div>
                    <LogOut className="size-4 text-[#8A9A96]" />
                  </div>
                </div>
              </div>

              {/* Main */}
              <div className="flex min-w-0 flex-1 flex-col bg-white">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4">
                  <div>
                    <h3 className="text-[18px] font-semibold tracking-tight">Добрый день, Айсултан</h3>
                    <p className="text-sm text-[#8A9A96]">Aisultan Boutique · 26 августа 2026 · обзор за сегодня</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden items-center gap-2 rounded-full border border-black/10 bg-[#FCFCF9] px-3 py-1.5 text-xs font-medium text-[#5A6B67] sm:inline-flex"><Search className="size-3.5" /> Поиск</span>
                    <span className="rounded-full border border-black/10 p-2"><Bell className="size-4 text-[#5A6B67]" /></span>
                    <span className="rounded-full bg-[#0E6B5E] px-4 py-2 text-sm font-semibold text-white">Синхронизировать каналы</span>
                  </div>
                </div>

                {/* KPI */}
                <div className="grid grid-cols-6 gap-3 bg-[#FCFCF9] px-6 py-4">
                  {[
                    { label: "Загрузка", value: "84%", sub: "18 из 24 сегодня", icon: Percent, accent: true },
                    { label: "Бронирования", value: "32", sub: "активных", icon: CalendarCheck2 },
                    { label: "Заезды сегодня", value: "3", sub: "1 уже заселён", icon: ArrowUp },
                    { label: "Выезды сегодня", value: "2", sub: "0 уже выселились", icon: ArrowDown },
                    { label: "Выручка MTD", value: "₸ 4.2M", sub: "за текущий месяц", icon: ReceiptText },
                    { label: "Свободно", value: "6", sub: "4 гостя проживают", icon: BedDouble },
                  ].map((k) => (
                    <div key={k.label} className={`rounded-2xl border bg-white p-3 ${k.accent ? "border-[#0E6B5E]/20 shadow-[0_2px_12px_rgba(14,107,94,0.08)]" : "border-black/[0.06]"}`}>
                      <div className="flex items-center justify-between"><span className="text-[11px] font-medium tracking-wide text-[#8A9A96]">{k.label}</span><k.icon className={`size-3.5 ${k.accent ? "text-[#0E6B5E]" : "text-[#8A9A96]"}`} /></div>
                      <div className="mt-1 text-[18px] font-semibold tracking-tight">{k.value}</div>
                      <div className="text-[11px] text-[#8A9A96]">{k.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Two tables */}
                <div className="grid grid-cols-2 gap-4 px-6">
                  {[
                    { title: "Заезды сегодня", count: 3 },
                    { title: "Выезды сегодня", count: 2 },
                  ].map((t) => (
                    <div key={t.title} className="rounded-2xl border border-black/[0.06] bg-white">
                      <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
                        <span className="text-sm font-semibold">{t.title}</span><span className="rounded-full bg-[#14201E] px-2 py-0.5 text-xs font-semibold text-white">{t.count}</span>
                      </div>
                      <div className="divide-y divide-black/[0.04] text-xs">
                        <div className="grid grid-cols-4 px-4 py-2 font-medium text-[#8A9A96]"><span>Гость</span><span>Номер</span><span>Канал</span><span>Статус</span></div>
                        <div className="grid grid-cols-4 px-4 py-2.5"><span className="font-medium">Айдана С.</span><span>301</span><span className="inline-flex h-5 items-center rounded-full bg-black/[0.06] px-2 text-[11px]">Booking</span><span className="text-[#0E6B5E]">Подтверждено</span></div>
                        <div className="grid grid-cols-4 px-4 py-2.5 bg-[#FCFCF9]"><span className="font-medium">Daniyar K.</span><span>205</span><span className="inline-flex h-5 items-center rounded-full bg-black/[0.06] px-2 text-[11px]">Ostrovok</span><span className="text-[#0E6B5E]">Заселён</span></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent + channels */}
                <div className="grid grid-cols-3 gap-4 px-6 py-4">
                  <div className="col-span-2 rounded-2xl border border-black/[0.06] bg-white p-4">
                    <div className="flex items-center justify-between"><span className="text-sm font-semibold">Последние бронирования</span><span className="text-xs text-[#8A9A96]">Нажмите на строку для деталей</span></div>
                    <div className="mt-3 divide-y divide-black/[0.06] text-xs">
                      <div className="grid grid-cols-5 px-2 py-1.5 font-medium text-[#8A9A96]"><span>Гость</span><span>Даты</span><span>Номер</span><span>Сумма</span><span>Статус</span></div>
                      {[
                        ["Coral Family", "26—29 авг", "102", "₸ 186 000", "Ожидает"],
                        ["Ерлан Т.", "25—27 авг", "210", "₸ 94 000", "Подтверждено"],
                        ["Sophie L.", "24—26 авг", "301", "₸ 210 000", "Заселён"],
                      ].map((r) => (
                        <div key={r[0]} className="grid grid-cols-5 px-2 py-2.5"><span className="font-medium">{r[0]}</span><span className="text-[#5A6B67]">{r[1]}</span><span>{r[2]}</span><span className="font-medium">{r[3]}</span><span className="text-[#0E6B5E]">{r[4]}</span></div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-black/[0.06] bg-[#FCFCF9] p-4">
                    <div className="text-sm font-semibold">Статус каналов</div>
                    <div className="text-xs text-[#8A9A96]">3 из 4 подключено</div>
                    <div className="mt-3 space-y-2">
                      {[
                        { name: "Booking.com", dot: "bg-emerald-500", sync: "2 мин назад" },
                        { name: "Ostrovok", dot: "bg-emerald-500", sync: "5 мин назад" },
                        { name: "Krisha.kz", dot: "bg-amber-400", sync: "ошибка" },
                        { name: "Прямые брони", dot: "bg-black/20", sync: "встроенный" },
                      ].map((c) => (
                        <div key={c.name} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs border border-black/[0.04]">
                          <span className="flex items-center gap-2 font-medium"><span className={`size-1.5 rounded-full ${c.dot}`} /> {c.name}</span><span className="text-[#8A9A96]">{c.sync}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-[#8A9A96]">Дэшборд: sidebar 236px · KPI 6 колонок · таблицы с hover · шрифт system-ui, радиус 16—20px, тени мягкие.</p>
        </section>

        <section className="rounded-2xl border border-dashed border-black/15 bg-white p-6 text-sm leading-6 text-[#5A6B67]">
          <div className="font-semibold text-[#14201E]">Как сохранить как изображения</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Открой эту страницу в браузере: <span className="font-mono text-xs">http://localhost:3000/design-preview</span></li>
            <li>Сделай скриншот каждого артборда — они уже в рамке с тенью, как на макете.</li>
            <li>Или нажми <span className="font-mono text-xs">Ctrl+P → Сохранить как PDF</span> и обрежь по рамкам.</li>
            <li>Хочешь экспорт в Figma — скажи, сгенерирую SVG/PNG файлы в <span className="font-mono text-xs">public/design/</span>.</li>
          </ol>
          <div className="mt-3 text-xs text-[#8A9A96]">Палитра: ink #14201E · muted #5A6B67 · line #E9E8E6 · accent #0E6B5E · paper #FFFEFB · surface #FCFCF9. Радиусы 16–24px, сетка 12 колонок, минимализм без лишнего декора.</div>
        </section>
      </div>
    </div>
  );
}
