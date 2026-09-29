"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, BedDouble, Building2, CalendarDays, Check, ChevronLeft, CircleCheck, Clock3, DoorOpen, Loader2, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BILLING_PLANS } from "@/lib/billing/policy";
import { createOnboardingApartmentsAction } from "@/server/actions/rooms";

const STEPS = ["Знакомство", "Профиль", "Квартиры", "Тариф"];
type LoadingKind = "workspace" | "profile" | "apartments" | "finish";
type PlanId = (typeof BILLING_PLANS)[number]["id"];

type HotelDraft = { name: string; city: string; language: "ru" | "kk" | "en" };
type ApartmentDraft = { number: string; floor: string; capacity: string; basePrice: string };

export interface OnboardingFormProps {
  initialStep: number;
  hotel: HotelDraft;
  apartment: ApartmentDraft | null;
  apartmentCount: number;
  trialDaysRemaining: number;
  previewMode?: boolean;
}

async function postProgress(body: Record<string, unknown>) {
  const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось сохранить данные");
}

export function OnboardingForm({ initialStep, hotel: initialHotel, apartment: initialApartment, apartmentCount, trialDaysRemaining, previewMode = false }: OnboardingFormProps) {
  const router = useRouter();
  const kk = initialHotel.language === "kk";
  const [step, setStep] = useState(Math.max(1, Math.min(4, initialStep)));
  const [pending, startTransition] = useTransition();
  const [hotel, setHotel] = useState(initialHotel);
  const [apartment, setApartment] = useState<ApartmentDraft>(initialApartment ?? { number: "101", floor: "1", capacity: "2", basePrice: "25000" });
  const [count, setCount] = useState(String(Math.max(1, apartmentCount)));
  const [loadingKind, setLoadingKind] = useState<LoadingKind | null>(null);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(BILLING_PLANS.find((plan) => plan.rooms >= apartmentCount)?.id ?? "business");
  const recommendedPlan = BILLING_PLANS.find((plan) => plan.rooms >= Number(count)) ?? BILLING_PLANS[BILLING_PLANS.length - 1];

  async function animateSetup(kind: LoadingKind) {
    setLoadingKind(kind);
    setCompletedTasks(0);
    for (let task = 1; task <= 3; task += 1) {
      await new Promise((resolve) => setTimeout(resolve, 360));
      setCompletedTasks(task);
    }
  }

  function enterProfile() {
    startTransition(async () => {
      await animateSetup("workspace");
      setLoadingKind(null);
      setStep(2);
    });
  }

  function saveProfile() {
    if (hotel.name.trim().length < 2 || hotel.city.trim().length < 2) {
      toast.error(kk ? "Атауы мен қаласын енгізіңіз" : "Укажите название и город");
      return;
    }
    startTransition(async () => {
      try {
        await animateSetup("profile");
        if (!previewMode) await postProgress({ action: "save-hotel", hotelName: hotel.name, city: hotel.city, country: "Казахстан", propertyType: "Апартаменты", language: hotel.language, currency: "KZT", timezone: "Asia/Almaty" });
        setLoadingKind(null);
        setStep(3);
      } catch (error) { setLoadingKind(null); toast.error(error instanceof Error ? error.message : (kk ? "Профиль сақталмады" : "Не удалось сохранить профиль")); }
    });
  }

  function createApartments() {
    startTransition(async () => {
      try {
        await animateSetup("apartments");
        if (!previewMode) {
          const result = await createOnboardingApartmentsAction({ firstNumber: apartment.number, count, floor: apartment.floor, capacity: apartment.capacity, basePrice: apartment.basePrice });
          if (!result.ok) { setLoadingKind(null); toast.error(result.error); return; }
          await postProgress({ action: "room-created" });
        }
        setSelectedPlan(BILLING_PLANS.find((plan) => plan.rooms >= Number(count))?.id ?? BILLING_PLANS[BILLING_PLANS.length - 1].id);
        setLoadingKind(null);
        setStep(4);
      } catch (error) { setLoadingKind(null); toast.error(error instanceof Error ? error.message : (kk ? "Деректер сақталмады" : "Не удалось сохранить шаг")); }
    });
  }

  function finish(destination: string) {
    startTransition(async () => {
      try {
        await animateSetup("finish");
        if (previewMode) toast.info("Это предпросмотр — данные не сохраняются.");
        else {
          await postProgress({ action: "complete", skipReservation: true });
          router.push(destination);
          router.refresh();
        }
        setLoadingKind(null);
      } catch (error) { setLoadingKind(null); toast.error(error instanceof Error ? error.message : (kk ? "Қайталап көріңіз" : "Не удалось завершить настройку")); }
    });
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#f4f7f4] px-3 py-2.5 text-[#20342c] sm:px-6 md:min-h-dvh md:h-auto md:overflow-visible md:py-9">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col md:flex-none">
        {previewMode ? <div className="mb-2 shrink-0 rounded-xl border border-[#cfe8db] bg-white px-3 py-1.5 text-center text-[10px] font-semibold text-[#087f68] sm:text-xs">Предпросмотр дизайна · данные не сохраняются</div> : null}
        <header className="mb-2 flex shrink-0 items-center justify-between md:mb-5">
          <Link href="/" className="flex items-center gap-2 text-sm font-extrabold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-[#087f68] text-white"><Sparkles className="size-5" /></span>Shanyraq</Link>
        </header>

        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col md:flex-none">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2 md:mb-5 md:gap-3">
            <button type="button" onClick={() => setStep((value) => Math.max(1, value - 1))} disabled={step === 1 || pending} className="flex size-10 items-center justify-center rounded-full bg-white text-[#63736b] shadow-sm disabled:invisible" aria-label={kk ? "Артқа" : "Назад"}><ChevronLeft className="size-5" /></button>
            <div className="flex flex-1 gap-1.5" aria-label={`${step} / 4`}>{STEPS.map((title, index) => <div key={title} className="min-w-0 flex-1"><div className={cn("h-1.5 rounded-full transition-colors duration-500", index < step ? "bg-[#08846b]" : "bg-[#dce5dd]")} /><span className={cn("mt-1.5 hidden truncate text-[9px] font-semibold sm:block", index === step - 1 ? "text-[#167c67]" : "text-[#a3ada5]")}>{title}</span></div>)}</div>
            <span className="w-10 text-right text-xs font-bold tabular-nums text-[#839088]">{step}/4</span>
          </div>

          <Card className="min-h-0 flex-1 overflow-hidden rounded-[24px] border-0 bg-white shadow-[0_24px_70px_-40px_rgba(18,72,56,.35)] md:flex-none md:rounded-[28px]">
            {loadingKind ? <LoadingStep kind={loadingKind} completedTasks={completedTasks} kk={kk} /> : null}
            {!loadingKind && step === 1 ? <WelcomeStep kk={kk} onContinue={enterProfile} /> : null}
            {!loadingKind && step === 2 ? <section className="flex h-full flex-col md:grid md:h-auto md:grid-cols-[.9fr_1.1fr]">
              <div className="profile-motion relative flex min-h-0 flex-[.72] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0c8a70] to-[#075747] p-4 text-white sm:p-8 md:min-h-48 md:flex-auto md:p-8"><div className="absolute -right-12 -top-14 size-44 rounded-full border-[22px] border-white/[.08] sm:-right-16 sm:size-56 sm:border-[28px]" /><div className="relative"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/65">{kk ? "Сіздің бизнесіңіз" : "Настроим профиль"}</p><h1 className="mt-1.5 text-xl font-extrabold leading-tight sm:mt-3 sm:text-2xl">{kk ? "Бастау үшін екі мәлімет жеткілікті." : "Две детали — и пространство готово."}</h1><p className="mt-1.5 text-xs text-white/75 sm:mt-2 sm:text-sm">{kk ? "Қалғанын кейін кез келген уақытта қосасыз." : "Название и город. Остальное можно добавить позже."}</p></div><ProfilePreview name={hotel.name} city={hotel.city} /></div>
              <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-4 sm:gap-5 sm:p-9"><div><p className="text-[10px] font-bold text-[#12816a] sm:text-xs">01 · {kk ? "Профиль" : "Профиль"}</p><h2 className="mt-1 text-lg font-extrabold sm:mt-2 sm:text-xl">{kk ? "Атауы мен қаласы" : "Название и город"}</h2></div>
                <Field label={kk ? "Бизнес немесе топ атауы" : "Как называется бизнес?"}><Input autoFocus value={hotel.name} onChange={(event) => setHotel({ ...hotel, name: event.target.value })} placeholder={kk ? "Мысалы, Abay Apartments" : "Например, Abay Apartments"} className="h-11 rounded-xl sm:h-12" /></Field>
                <Field label={kk ? "Қала" : "Город"}><Input value={hotel.city} onChange={(event) => setHotel({ ...hotel, city: event.target.value })} placeholder="Астана" className="h-11 rounded-xl sm:h-12" /></Field>
                <Button type="button" onClick={saveProfile} disabled={pending} className="h-11 w-full shrink-0 rounded-xl bg-[#087f68] text-sm font-bold hover:bg-[#066b57] sm:h-12">{pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}{kk ? "Жалғастыру" : "Сохранить и продолжить"}<ArrowRight className="ml-2 size-4" /></Button>
              </div>
            </section> : null}

            {!loadingKind && step === 3 ? <ApartmentSetupStep kk={kk} apartment={apartment} setApartment={setApartment} count={count} setCount={setCount} pending={pending} onContinue={createApartments} /> : null}

            {!loadingKind && step === 4 ? <PricingStep kk={kk} count={count} selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan} recommendedPlan={recommendedPlan} pending={pending} trialDaysRemaining={trialDaysRemaining} onFinish={finish} /> : null}
          </Card>

          <p className="mt-3 hidden shrink-0 text-center text-[10px] text-[#96a198] md:block">{kk ? "Профильді кез келген қадамда жалғастыруға болады." : "Ваш прогресс сохраняется — настройку можно продолжить позже."}</p>
        </div>
      </div>
    </main>
  );
}

function WelcomeStep({ kk, onContinue }: { kk: boolean; onContinue: () => void }) {
  return <section className="flex h-full min-h-0 flex-col md:grid md:h-auto md:grid-cols-2">
    <div className="relative flex min-h-0 flex-[1.5] flex-col gap-2 overflow-hidden bg-gradient-to-br from-[#0a886d] via-[#087b64] to-[#075746] p-3 text-white sm:p-9 md:min-h-[450px] md:flex-auto md:justify-between">
      <div className="absolute -right-20 -top-20 size-64 animate-[spin_35s_linear_infinite] rounded-full border border-white/15 motion-reduce:animate-none sm:size-80" />
      <div className="absolute -right-12 top-8 size-44 rounded-full border border-white/10 sm:size-56" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-bold sm:px-3 sm:py-1.5 sm:text-[10px]"><Sparkles className="size-3.5" />{kk ? "Қазақстанда пәтерді тәуліктік жалға беру" : "Для посуточной аренды в Казахстане"}</span>
        <h1 className="mt-1.5 max-w-sm text-xl font-extrabold leading-[1.08] tracking-tight sm:mt-6 sm:text-4xl">{kk ? "Пәтерлерді басқарудың оңай жолы." : "Порядок в посуточной аренде — с первого дня."}</h1>
        <p className="mt-1 max-w-sm text-[11px] leading-4 text-white/75 sm:mt-3 sm:text-sm sm:leading-6">{kk ? "Күнтізбе, броньдар мен қонақтар — бір жерде." : "Календарь, брони и гости — в одном понятном приложении."}</p>
      </div>
      <CalendarPreview kk={kk} />
    </div>
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 p-3 sm:gap-4 sm:p-9">
      <div className="space-y-2 sm:space-y-4">
        <Benefit icon={CalendarDays} tone="mint" title={kk ? "Бос күндер бірден көрінеді" : "Свободные даты видны сразу"} text={kk ? "Броньдар бір күнтізбеде." : "Все брони и занятость собраны в одном календаре."} />
        <Benefit icon={ShieldCheck} tone="amber" title={kk ? "Қос броньнан қорғаныс" : "Меньше риска двойного бронирования"} text={kk ? "Бос емес күндер бірден есепке алынады." : "Система учитывает уже занятые даты."} />
        <Benefit icon={WalletCards} tone="blue" title={kk ? "Броньдар мен кіріс ретімен" : "Брони и доходы под рукой"} text={kk ? "Маңыздысы телефоннан қолжетімді." : "Заселения и стоимость всегда под рукой."} />
      </div>
      <Button type="button" onClick={onContinue} className="mt-auto h-11 w-full shrink-0 rounded-xl bg-[#087f68] font-bold hover:bg-[#066b57] sm:mt-3 sm:h-12"><span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-white/15">1</span>{kk ? "Профильді баптау" : "Настроить профиль"}<ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" /></Button>
      <p className="text-center text-[9px] text-[#94a098] sm:text-[10px]">{kk ? "Шамамен 1 минут · карта қажет емес" : "Около 1 минуты · карта не нужна"}</p>
    </div>
  </section>;
}

function CalendarPreview({ kk }: { kk: boolean }) {
  return <div className="calendar-preview relative -top-8 mt-auto w-full max-w-[330px] -translate-y-16 -rotate-1 rounded-xl border border-white/20 bg-white p-1.5 text-[#34453c] shadow-2xl shadow-black/15 transition-transform duration-500 sm:top-0 sm:mt-8 sm:translate-y-0 sm:rounded-2xl sm:p-3 md:hover:rotate-0">
    <div className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-[#c8f4dc] text-[#087f68] shadow-md motion-safe:animate-bounce motion-reduce:animate-none"><Sparkles className="size-3.5" /></div>
    <div className="mb-1 flex items-center justify-between sm:mb-3"><div><p className="text-[8px] font-bold text-[#849188]">{kk ? "ПӘТЕРЛЕРІҢІЗ" : "ВАШИ КВАРТИРЫ"}</p><p className="mt-0.5 text-[10px] font-extrabold sm:text-xs">{kk ? "Маусым" : "Июнь"}</p></div><span className="rounded-full bg-[#e3f4eb] px-2 py-1 text-[7px] font-bold text-[#0c8368] motion-safe:animate-pulse sm:text-[8px]">+ {kk ? "Бронь" : "Новая бронь"}</span></div>
    <div className="grid grid-cols-[62px_repeat(5,1fr)] gap-1 text-center text-[7px] text-[#8d9990] sm:grid-cols-[72px_repeat(5,1fr)]"><span />{[12, 13, 14, 15, 16].map((day) => <span key={day}>{day}</span>)}{["101"].map((room, index) => <div key={room} className="contents"><span className="py-1 text-left font-bold text-[#526359] sm:py-1.5">{kk ? "Пәтер" : "Квартира"} {room}</span>{[0, 1, 2, 3, 4].map((day) => <span key={day} style={{ animationDelay: `${(index * 5 + day) * 90}ms` }} className={cn("my-0.5 h-2.5 rounded-md sm:my-1 sm:h-5", (day + index) % 3 === 0 ? "motion-safe:animate-pulse bg-[#d7efe3]" : (day + index) % 4 === 0 ? "bg-[#e5edfb]" : "bg-[#f1f4f1]")} />)}</div>)}</div>
  </div>;
}

function Benefit({ icon: Icon, tone, title, text }: { icon: typeof CalendarDays; tone: "mint" | "amber" | "blue"; title: string; text: string }) { const tones = { mint: "bg-[#d9f3e7] text-[#087f68]", amber: "bg-[#fff0cf] text-[#aa6c13]", blue: "bg-[#e2eafe] text-[#536dc1]" }; return <div className="flex items-center gap-3 sm:items-start sm:gap-3"><span className={cn("grid size-10 shrink-0 place-items-center rounded-xl sm:size-11", tones[tone])}><Icon className="size-5 sm:size-[22px]" /></span><div><p className="text-[13px] font-extrabold leading-4 sm:text-sm">{title}</p><p className="mt-0.5 text-[11px] leading-4 text-[#68796f] sm:mt-1 sm:text-xs sm:leading-5">{text}</p></div></div>; }

function ProfilePreview({ name, city }: { name: string; city: string }) {
  return <div className="profile-motion-card relative mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-sm sm:mt-6 sm:gap-3 sm:p-3">
    <div className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 sm:size-11"><BedDouble className="size-4 sm:size-5" /><span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-[#c5f0d9] text-[#087f68]"><Check className="size-3" /></span></div>
    <div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold sm:text-sm">{name || "Мои квартиры"}</p><p className="mt-0.5 text-[10px] text-white/70 sm:text-xs">{city || "Астана"}</p></div>
    <span className="flex gap-1" aria-hidden="true"><i className="size-1.5 rounded-full bg-white/50 motion-safe:animate-pulse" /><i className="size-1.5 rounded-full bg-white/50 [animation-delay:200ms] motion-safe:animate-pulse" /><i className="size-1.5 rounded-full bg-white/50 [animation-delay:400ms] motion-safe:animate-pulse" /></span>
  </div>;
}

function ApartmentSetupStep({ kk, apartment, setApartment, count, setCount, pending, onContinue }: { kk: boolean; apartment: ApartmentDraft; setApartment: (draft: ApartmentDraft) => void; count: string; setCount: (value: string) => void; pending: boolean; onContinue: () => void }) {
  const label = kk ? "Пәтер" : "Квартира";
  const places = Number(apartment.capacity) || 0;
  const price = new Intl.NumberFormat("ru-KZ").format(Number(apartment.basePrice) || 0);
  return <section className="flex h-full min-h-0 flex-col p-3 sm:p-8 md:grid md:h-auto md:grid-cols-[.8fr_1.2fr] md:p-0">
    <div className="relative hidden min-h-48 flex-col justify-between overflow-hidden bg-[#e8f3ed] p-8 md:flex"><div className="absolute -right-10 -top-7 size-48 rounded-full bg-[#c8e7d8]" /><div className="relative"><p className="text-xs font-bold text-[#16816a]">02 · {kk ? "Пәтерлер" : "Квартиры"}</p><h1 className="mt-3 text-2xl font-extrabold leading-tight">{kk ? "Күнтізбені дайындаймыз." : "Каждая квартира — в календаре."}</h1><p className="mt-2 text-sm text-[#73847a]">{kk ? "Баға мен сыйымдылықты кейін де өзгертуге болады." : "Цену и вместимость можно изменить позже."}</p></div><ApartmentIllustration />
    </div>
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 md:gap-4 md:p-8">
      <div className="flex items-center gap-3 md:hidden"><ApartmentIllustration compact /><div><p className="text-[9px] font-bold text-[#16816a]">02 · {kk ? "Пәтерлер" : "Квартиры"}</p><h1 className="text-lg font-extrabold leading-tight">{kk ? "Күнтізбені дайындаймыз" : "Добавим квартиры"}</h1></div></div>
      <div className="hidden md:block"><h2 className="text-xl font-extrabold">{kk ? "Қанша пәтер қосамыз?" : "Сколько квартир добавить?"}</h2><p className="mt-1 text-sm text-[#829087]">{kk ? "Баға мен сыйымдылық бастапқыда бірдей болады." : "Цена и вместимость сначала будут одинаковыми."}</p></div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <Field label={kk ? "Пәтер нөмірі" : "Номер квартиры"}><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#8a988f]">№</span><Input value={apartment.number} onChange={(event) => setApartment({ ...apartment, number: event.target.value })} placeholder="101" className="h-10 rounded-xl pl-8 sm:h-11" /></div></Field>
        <Field label={kk ? "Пәтер саны" : "Количество квартир"}><Input type="number" min="1" max="100" value={count} onChange={(event) => setCount(event.target.value)} className="h-10 rounded-xl sm:h-11" /></Field>
        <Field label={kk ? "Қонақ орны" : "Мест для гостей"}><Input type="number" min="1" max="30" value={apartment.capacity} onChange={(event) => setApartment({ ...apartment, capacity: event.target.value })} className="h-10 rounded-xl sm:h-11" /></Field>
        <Field label={kk ? "Бір түн, ₸" : "Цена за ночь, ₸"}><Input type="number" min="1000" max="999000" step="500" value={apartment.basePrice} onChange={(event) => setApartment({ ...apartment, basePrice: event.target.value })} className="h-10 rounded-xl sm:h-11" /></Field>
      </div>
      <div className="apartment-live-card relative flex items-center gap-3 overflow-hidden rounded-xl border border-[#d8eee1] bg-[#f3faf5] px-3 py-2.5 sm:py-3">
        <ApartmentIllustration compact />
        <div className="min-w-0"><p className="text-xs font-extrabold text-[#33453a]">{label} {apartment.number || "101"}</p><p className="mt-0.5 text-[10px] text-[#718177]">{places} {places === 1 ? (kk ? "орын" : "место") : (kk ? "орын" : "места")} {kk ? "қонаққа" : "для гостей"} · {price} ₸ / {kk ? "түн" : "ночь"}</p></div>
        <span className="ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-white text-[#0d8268] shadow-sm motion-safe:animate-pulse"><Check className="size-4" /></span>
      </div>
      <p className="text-[9px] leading-4 text-[#87948b] sm:text-[10px]">{kk ? "Фотосуреттерді пәтер карточкасына кейін қосасыз." : "Фотографии добавите позже в карточке квартиры."}</p>
      <Button type="button" onClick={onContinue} disabled={pending || !apartment.number.trim() || Number(count) < 1 || Number(count) > 100} className="mt-auto h-11 w-full shrink-0 rounded-xl bg-[#087f68] text-sm font-bold hover:bg-[#066b57] sm:h-12">{pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <BedDouble className="mr-2 size-4" />}{pending ? (kk ? "Пәтерлерді дайындау…" : "Подготавливаем квартиры…") : (kk ? `${count} пәтерді қосу` : formatApartmentsLabel(count))}<ArrowRight className="ml-2 size-4" /></Button>
    </div>
  </section>;
}

function ApartmentIllustration({ compact = false }: { compact?: boolean }) {
  return <div className={cn("apartment-illustration relative z-10 flex shrink-0 items-center gap-1.5", compact ? "h-8 w-14 sm:h-10 sm:w-16" : "mt-5 h-24 w-full gap-2")}>
    <div className="apartment-tile apartment-tile-one relative flex h-[72%] flex-1 items-center justify-center rounded-lg bg-[linear-gradient(140deg,#fefaf1_0%,#d7e5d9_45%,#97bca9_100%)] text-[#287356] shadow-lg">{compact ? <Building2 className="size-4 sm:size-5" /> : <><span className="absolute bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-t-sm bg-white/85 sm:bottom-2 sm:h-4 sm:w-3" /><span className="absolute left-2 top-2 size-1.5 rounded-sm bg-white/75 sm:left-3 sm:top-3 sm:size-2" /><span className="absolute right-2 top-2 size-1.5 rounded-sm bg-white/75 sm:right-3 sm:top-3 sm:size-2" /></>}</div>
    <div className="apartment-tile apartment-tile-two relative flex h-full flex-1 items-center justify-center rounded-lg bg-[linear-gradient(140deg,#fff9ec_0%,#f4d7b6_47%,#cf9871_100%)] text-[#9a633d] shadow-lg">{compact ? <DoorOpen className="size-4 sm:size-5" /> : <><span className="absolute bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-t-sm bg-white/85 sm:bottom-2 sm:h-4 sm:w-3" /><span className="absolute left-2 top-2 size-1.5 rounded-sm bg-white/75 sm:left-3 sm:top-3 sm:size-2" /><span className="absolute right-2 top-2 size-1.5 rounded-sm bg-white/75 sm:right-3 sm:top-3 sm:size-2" /></>}</div>
    {!compact ? <div className="grid size-9 place-items-center rounded-xl bg-white text-[#158168] shadow-lg motion-safe:animate-bounce motion-reduce:animate-none"><Check className="size-5" /></div> : null}
  </div>;
}

function PricingStep({ kk, count, selectedPlan, setSelectedPlan, recommendedPlan, pending, trialDaysRemaining, onFinish }: { kk: boolean; count: string; selectedPlan: PlanId; setSelectedPlan: (id: PlanId) => void; recommendedPlan: (typeof BILLING_PLANS)[number]; pending: boolean; trialDaysRemaining: number; onFinish: (destination: string) => void }) {
  return <section className="flex h-full min-h-0 flex-col p-3 sm:p-8 md:h-auto md:p-9">
    <div className="text-center"><span className="mx-auto grid size-8 place-items-center rounded-xl bg-[#e1f4eb] text-[#0d876b] sm:size-11 sm:rounded-2xl"><CircleCheck className="size-5 sm:size-6" /></span><p className="mt-1.5 text-[9px] font-bold uppercase tracking-[.17em] text-[#13836b] sm:mt-3 sm:text-xs">{kk ? "Дайын" : "Почти готово"}</p><h1 className="mt-0.5 text-lg font-extrabold sm:mt-1 sm:text-2xl">{kk ? "Профиль жасалды." : "Пространство готово."}</h1><p className="mx-auto mt-1 hidden max-w-xl text-sm leading-6 text-[#7a8980] min-[390px]:block">{kk ? "Күнтізбе, броньдар мен қонақтар бір жерде." : "Календарь, брони и гости теперь в одном месте."}</p></div>
    <div className="my-2.5 flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#087f68] to-[#10a17e] p-2.5 text-white shadow-lg shadow-[#07866b]/15 sm:my-4 sm:gap-3 sm:rounded-2xl sm:p-4"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/15 sm:size-10 sm:rounded-xl"><Clock3 className="size-4 sm:size-5" /></span><div className="min-w-0 flex-1"><p className="text-xs font-extrabold sm:text-sm">{trialDaysRemaining > 0 ? (kk ? `${trialDaysRemaining} күн тегін` : `${trialDaysRemaining} дней бесплатно`) : (kk ? "Тарифті таңдау" : "Выберите тариф")}</p><p className="text-[9px] text-white/75 sm:mt-0.5 sm:text-xs">{trialDaysRemaining > 0 ? (kk ? "Карта қажет емес · автоматты төлем жоқ" : "Без карты · без автоматического списания") : (kk ? "Бір реттік төлем" : "Без автопродления")}</p></div><span className="hidden rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold sm:inline-flex">{kk ? "14 күн" : "14 дней"}</span></div>
    <div className="grid grid-cols-3 gap-1.5 sm:gap-3">{BILLING_PLANS.map((plan) => { const annual = plan.monthlyKzt * 10; const active = (selectedPlan || recommendedPlan.id) === plan.id; const fits = plan.rooms >= Number(count); return <button key={plan.id} type="button" disabled={!fits} onClick={() => setSelectedPlan(plan.id)} className={cn("relative min-w-0 rounded-xl border p-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-35 sm:rounded-2xl sm:p-4", active ? "border-[#08846b] bg-[#f1faf6] ring-2 ring-[#07866b]/15" : "border-[#e5ebe5] bg-white hover:border-[#b9d7ca]")}>
      {plan.id === recommendedPlan.id ? <span className="absolute -top-2 right-1 rounded-full bg-[#dff3e8] px-1.5 py-0.5 text-[7px] font-bold text-[#0d7a60] sm:right-2 sm:px-2 sm:text-[9px]">{kk ? "Сізге сай" : "Подходит"}</span> : null}
      <b className="block truncate text-[10px] sm:text-sm">{plan.name}</b><span className="mt-1 block truncate text-sm font-extrabold tabular-nums sm:mt-3 sm:text-xl">{new Intl.NumberFormat("ru-KZ").format(plan.monthlyKzt)} ₸</span><span className="block text-[8px] text-[#839087] sm:text-[10px]">/ {kk ? "ай" : "мес."}</span>
      <span className="mt-1 block min-h-6 text-[8px] leading-3 text-[#718177] sm:mt-2 sm:min-h-0 sm:text-[10px] sm:leading-4">{kk ? `${plan.rooms} пәтерге дейін` : plan.range}</span>
      <span className="mt-1 hidden border-t border-[#e7eee8] pt-2 text-[9px] font-semibold text-[#148168] sm:block">{new Intl.NumberFormat("ru-KZ").format(annual)} ₸ / год · 2 месяца бесплатно</span>
      <span className="mt-1 block min-h-5 text-[7px] leading-3 text-[#148168] sm:hidden">{plan.id === "business" ? "Booking · Airbnb" : plan.id === "pro" ? "3+ квартиры" : "Календарь"}</span>
      <span className="mt-1 hidden text-[10px] text-[#73847a] sm:block">{plan.description}</span>
    </button>; })}</div>
    <div className="mt-auto grid shrink-0 grid-cols-2 gap-2 pt-2.5 sm:mt-4 sm:gap-3"><Button type="button" onClick={() => onFinish(trialDaysRemaining > 0 ? "/dashboard" : `/dashboard/billing?plan=${selectedPlan}`)} disabled={pending} className="h-10 min-w-0 rounded-xl bg-[#087f68] px-2 text-[10px] font-bold hover:bg-[#066b57] sm:h-12 sm:px-4 sm:text-sm">{pending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Sparkles className="mr-1.5 size-4" />}{trialDaysRemaining > 0 ? (kk ? `${trialDaysRemaining} күн тегін` : `Бесплатно · ${trialDaysRemaining} дней`) : (kk ? "Тарифті таңдау" : "Выбрать тариф")}<ArrowRight className="ml-1 size-3.5 sm:ml-2 sm:size-4" /></Button><Button type="button" variant="outline" onClick={() => onFinish(trialDaysRemaining > 0 ? `/dashboard/billing?plan=${selectedPlan}` : "/dashboard")} disabled={pending} className="h-10 min-w-0 rounded-xl px-2 text-[10px] sm:h-12 sm:px-4 sm:text-sm">{trialDaysRemaining > 0 ? (kk ? "Тарифтер" : "К тарифам") : (kk ? "Күнтізбе" : "Открыть календарь")}</Button></div>
    <p className="mt-1.5 flex shrink-0 items-center justify-center gap-1 text-[8px] text-[#89958d] sm:mt-3 sm:text-[10px]"><ShieldCheck className="size-3 sm:size-3.5" />{kk ? "Тарифті кейін өзгертуге болады" : "Тариф можно изменить позже"}</p>
  </section>;
}

function LoadingStep({ kind, completedTasks, kk }: { kind: LoadingKind; completedTasks: number; kk: boolean }) {
  const LoadingIcon = kind === "apartments" ? BedDouble : kind === "finish" ? CalendarDays : kind === "profile" ? BadgeCheck : Sparkles;
  const title: Record<LoadingKind, string> = { workspace: kk ? "Кеңістікті дайындаймыз" : "Готовим пространство", profile: kk ? "Профильді сақтаймыз" : "Настраиваем профиль", apartments: kk ? "Пәтерлерді қосамыз" : "Добавляем квартиры", finish: kk ? "Күнтізбені ашамыз" : "Открываем календарь" };
  const tasks: Record<LoadingKind, string[]> = {
    workspace: ["Создаём рабочее пространство", "Готовим календарь бронирований", "Настраиваем профиль апартаментов"],
    profile: ["Сохраняем название и город", "Создаём профиль аренды", "Готовим календарь для квартир"],
    apartments: ["Добавляем квартиры в список", "Сохраняем места и цену за ночь", "Проверяем календарь занятости"],
    finish: ["Сохраняем настройки профиля", "Запускаем бесплатный период", "Открываем ваш календарь"],
  };
  return <section className="flex h-full min-h-0 flex-col items-center justify-center p-5 text-center sm:p-9" role="status" aria-live="polite">
    <div className="relative grid size-20 place-items-center sm:size-24"><span className="absolute inset-0 rounded-[28px] border-2 border-[#d8eee1] motion-safe:animate-[spin_5s_linear_infinite] motion-reduce:animate-none" /><span className="absolute inset-2 rounded-[24px] bg-[#e9f6ee]" /><span className="relative grid size-12 place-items-center rounded-2xl bg-[#087f68] text-white shadow-lg shadow-[#087f68]/20 motion-safe:animate-pulse"><LoadingIcon className="size-6" /></span><span className="absolute -right-1 top-1 grid size-6 place-items-center rounded-full bg-white text-[#0c896c] shadow motion-safe:animate-bounce motion-reduce:animate-none"><Sparkles className="size-3.5" /></span></div>
    <h1 className="mt-5 text-xl font-extrabold sm:text-2xl">{title[kind]}<span className="inline-block w-6 animate-pulse text-left">…</span></h1><p className="mt-1.5 text-xs text-[#839087] sm:text-sm">{completedTasks}/3 · {kk ? "бәрі дайындалып жатыр" : "всё идёт по плану"}</p>
    <div className="mt-5 w-full max-w-sm space-y-2 text-left sm:mt-7 sm:space-y-3">{tasks[kind].map((task, index) => <div key={task} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-500 sm:px-4 sm:py-3", index < completedTasks ? "border-[#cce9d8] bg-[#f2faf5]" : "border-[#edf1ed] bg-[#fbfcfb]")}><span className={cn("grid size-6 shrink-0 place-items-center rounded-full transition-colors", index < completedTasks ? "bg-[#0d896b] text-white" : "bg-[#edf2ee] text-[#90a098]")}>{index < completedTasks ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}</span><span className={cn("text-xs font-semibold sm:text-sm", index < completedTasks ? "text-[#35473d]" : "text-[#89968e]")}>{task}</span>{index === completedTasks ? <Loader2 className="ml-auto size-4 shrink-0 animate-spin text-[#10816a]" /> : null}</div>)}</div>
    <div className="mt-5 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-[#e7eee8] sm:mt-7"><div className="h-full rounded-full bg-gradient-to-r from-[#087f68] to-[#49c39b] transition-all duration-500" style={{ width: `${Math.max(8, (completedTasks / 3) * 100)}%` }} /></div>
  </section>;
}

function formatApartmentsLabel(value: string) { const amount = Number(value); const form = Number.isFinite(amount) ? new Intl.PluralRules("ru").select(amount) : "many"; const noun = form === "one" ? "квартиру" : form === "few" ? "квартиры" : "квартир"; return `Добавить ${value} ${noun}`; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label className="text-xs font-bold text-[#58695e]">{label}</Label>{children}</div>; }
