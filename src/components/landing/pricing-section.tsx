"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import s from "./landing.module.css";

const plans = [
  { name: "Start", price: 9900, description: "Для владельцев нескольких квартир", capacity: "До 3 квартир или номеров", features: ["Календарь бронирований", "Гости и оплаты", "Импорт из Excel", "Базовая поддержка"], cta: "Начать бесплатно" },
  { name: "Pro", price: 19900, description: "Для растущих апарт-отелей", capacity: "До 15 квартир или номеров", features: ["Всё из Start", "Расширенные отчёты", "Сотрудники", "Экспорт данных", "Приоритетная поддержка"], cta: "Выбрать Pro" },
  { name: "Business", price: 39900, description: "Для управляющих компаний", capacity: "До 50 квартир или номеров", features: ["Всё из Pro", "Несколько объектов", "Расширенное управление доступом", "Персональное подключение", "Приоритетная поддержка"], cta: "Обсудить подключение" },
];
const formatPrice = (price: number) => new Intl.NumberFormat("ru-KZ").format(price);

export function PricingSection() {
  const [annual, setAnnual] = useState(false);
  return <section id="pricing" className={`${s.section} ${s.pricingSection}`}><div className={s.container}>
    <div className={`${s.sectionHeading} ${s.centered}`}><span className={s.sectionEyebrow}>Понятная цена. Никаких сложностей.</span><h2>Тариф, который растёт<br />вместе с вашим объектом</h2><p>Начните с нужного масштаба. Меняйте тариф по мере роста.</p></div>
    <div className={s.billingControl}><div className={s.billingToggle} role="group" aria-label="Период оплаты"><button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>Ежемесячно</button><button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>Ежегодно</button></div><span>2 месяца бесплатно</span></div>
    <div className={s.pricingGrid} aria-live="polite">{plans.map((plan) => <article className={`${s.priceCard} ${plan.name === "Pro" ? s.proCard : ""}`} key={plan.name}>{plan.name === "Pro" && <div className={s.popularBadge}>Самый популярный</div>}<h3>{plan.name}</h3><p className={s.planDescription}>{plan.description}</p><div className={s.planPrice}>{formatPrice(plan.price * (annual ? 10 : 1))}<span> ₸</span><small>/ {annual ? "год" : "месяц"}</small></div><p className={s.billingNote}>{annual ? `${formatPrice(Math.round(plan.price * 10 / 12))} ₸ / мес. при оплате за год` : "При ежемесячной оплате"}</p><div className={s.planCapacity}>{plan.capacity}</div><ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul><Button asChild className={plan.name === "Pro" ? s.primaryButton : s.secondaryButton} variant={plan.name === "Pro" ? "default" : "outline"}>{plan.name === "Business" ? <a href="mailto:hello@shanyraq.ai?subject=Подключение%20Shanyraq%20AI%20Business">{plan.cta}<ArrowUpRight size={15} /></a> : <Link href="/register">{plan.cta}<ArrowUpRight size={15} /></Link>}</Button></article>)}</div>
    <p className={s.pricingFootnote}><Check size={14} /> 14 дней бесплатного доступа. Отменить можно в любой момент.</p>
  </div></section>;
}
