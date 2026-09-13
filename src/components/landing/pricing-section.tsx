"use client";

import { useBetaInvite } from "./beta-invite";

import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import s from "./landing.module.css";

const plans = [
  { name: "Start", price: 0, description: "Для владельцев нескольких квартир", capacity: "До 3 квартир или номеров", features: ["Календарь бронирований", "Гости и оплаты", "Импорт из Excel", "Базовая поддержка"], cta: "Начать бесплатно" },
  { name: "Pro", price: 0, description: "Для растущих апарт-отелей", capacity: "До 15 квартир или номеров", features: ["Всё из Start", "Расширенные отчёты", "Сотрудники", "Экспорт данных", "Приоритетная поддержка"], cta: "Выбрать Pro" },
  { name: "Business", price: 0, description: "Для управляющих компаний", capacity: "До 50 квартир или номеров", features: ["Всё из Pro", "Несколько объектов", "Расширенное управление доступом", "Персональное подключение", "Приоритетная поддержка"], cta: "Обсудить подключение" },
];

export function PricingSection() {
  const openBeta = useBetaInvite();
  return <section id="pricing" className={`${s.section} ${s.pricingSection}`}><div className={s.container}>
    <div className={`${s.sectionHeading} ${s.centered}`}><span className={s.sectionEyebrow}>Понятная цена. Никаких сложностей.</span><h2>Тариф, который растёт<br />вместе с вашим объектом</h2><p>Выберите свой масштаб. Во время бета-теста все тарифы бесплатны.</p></div>
    <div className={s.betaBanner}><span className={s.betaBadge}>BETA TEST</span><span>Все возможности — бесплатно на время бета-теста</span><button type="button" onClick={openBeta}>Оставить заявку ↗</button></div>
    <div className={s.pricingGrid} aria-live="polite">{plans.map((plan) => <article className={`${s.priceCard} ${plan.name === "Pro" ? s.proCard : ""}`} key={plan.name}>{plan.name === "Pro" && <div className={s.popularBadge}>Самый популярный</div>}<h3>{plan.name}</h3><p className={s.planDescription}>{plan.description}</p><div className={s.planPrice}>0<span> ₸</span><small>/ месяц</small></div><p className={s.billingNote}>Бесплатно на время бета-теста</p><div className={s.planCapacity}>{plan.capacity}</div><ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul><Button onClick={openBeta} className={plan.name === "Pro" ? s.primaryButton : s.secondaryButton} variant={plan.name === "Pro" ? "default" : "outline"}>{plan.cta}<ArrowUpRight size={15} /></Button></article>)}</div>
    <p className={s.pricingFootnote}><Check size={14} /> Сейчас 0 ₸. Банковская карта не нужна. О завершении бета-теста сообщим заранее.</p>
  </div></section>;
}
