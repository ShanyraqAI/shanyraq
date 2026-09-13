"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, CircleCheck, Download, ShieldCheck, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ReservationsShowcase } from "./reservations-showcase";
import { ChannelConnector } from "./channel-connector";
import { InteractiveOccupancyChart } from "./interactive-occupancy-chart";
import p from "./premium.module.css";
import s from "./landing.module.css";

const reportRows = [["Выручка", "₸ 1 284 000", "18.4%"], ["Загрузка", "84%", "12%"], ["ADR", "₸ 24 800", "9.1%"], ["RevPAR", "₸ 20 832", "15.6%"]];

function StoryHeading({ number, label, title, description }: { number: string; label: string; title: string; description: string }) {
  return <div className={p.storyHeading} data-scroll-reveal><span className={p.sectionPill}><b>{number}</b>{label}</span><h2>{title}</h2><p>{description}</p></div>;
}

export function ProductStory() {
  const [rateType, setRateType] = useState("Делюкс");
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [exported, setExported] = useState(false);

  function exportReport() {
    const csv = "\uFEFFПоказатель;Значение;Изменение\r\n" + reportRows.map(row => row.join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "Shanyraq-Пример-отчёта-Сентябрь-2026.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
  }

  return <div className={p.productStory}>
    <section id="features" className={`${s.container} ${p.storySection}`}>
      <StoryHeading number="01" label="Возможности" title="Вся работа объекта — в одном пространстве" description="Бронирования, номера, гости и оплаты — всё, что нужно для спокойной работы отеля." />
      <ReservationsShowcase />
    </section>

    <section className={`${s.container} ${p.storySection}`}>
      <StoryHeading number="02" label="Тарифы и аналитика" title="Тарифы и загрузка под вашим контролем" description="Управляйте ценами, следите за загрузкой и ключевыми показателями в реальном времени." />
      <div className={p.analyticsGrid}>
        <article className={p.panel} data-scroll-reveal><div className={p.panelHeading}><h3>Тарифы</h3><span className={p.example}>Пример</span></div><div className={p.filters}><select aria-label="Категория тарифа" value={rateType} onChange={e => setRateType(e.target.value)}><option>Делюкс</option><option>Стандарт</option></select><span>Сентябрь 2026 <ChevronDown size={12} /></span></div><table className={p.dataTable}><thead><tr><th>Дата</th><th>Базовый тариф</th><th>Итоговая цена</th></tr></thead><tbody>{[13, 14, 15, 16].map((day, i) => <tr key={day}><td>{day} сен</td><td>₸ {rateType === "Делюкс" ? "24 000" : "16 000"}</td><td><strong>₸ {rateType === "Делюкс" ? (i === 1 || i === 2 ? "28 800" : "24 000") : (i === 1 || i === 2 ? "19 200" : "16 000")}</strong></td></tr>)}</tbody></table></article>
        <article className={`${p.panel} ${p.chartPanel}`} data-scroll-reveal><InteractiveOccupancyChart /></article>
        <article className={p.panel} data-scroll-reveal><div className={p.panelHeading}><h3>Ключевые показатели</h3></div>{reportRows.filter(row => row[0] !== "Загрузка").map(row => <div className={p.metricRow} key={row[0]}><span>{row[0]}</span><div><strong>{row[1]}</strong><small><ArrowUpRight size={13} />{row[2]}</small></div></div>)}</article>
      </div>
    </section>

    <section className={`${s.container} ${p.storySection}`} id="channels">
      <StoryHeading number="03" label="Каналы" title="Все каналы. Один календарь." description="Бронирования с популярных площадок — в Shanyraq AI. Единая картина загрузки вашего объекта." />
      <div className={p.channelFlow} data-scroll-reveal>
        <div className={p.channelList}>{[["B", "Booking.com", p.bookingIcon], ["O", "Ostrovok.ru", p.ostrovokIcon], ["K", "Krisha.kz", p.krishaIcon]].map(([letter, name, cls]) => <div key={name}><b className={cls}>{letter}</b><p><strong>{name}</strong><small>Интеграция в разработке</small></p><span className={p.channelDot} /></div>)}</div>
        <ChannelConnector />
        <div className={p.channelHub}><BrandLogo style={{ width: 190, height: 40 }} /></div>
        <ChannelConnector short />
        <div className={`${p.panel} ${p.syncPanel}`}><h3>Синхронизация</h3>{["Новые бронирования", "Обновление статусов", "Актуальная доступность"].map(text => <p key={text}><CircleCheck size={15} />{text}</p>)}<small>Схема работы после подключения каналов</small></div>
      </div>
      <p className={p.integrationNote}>Готовим подключения к площадкам. Доступность зависит от API и согласования с каналом.</p>
    </section>

    <section className={`${s.container} ${p.storySection}`}>
      <StoryHeading number="04" label="Отчёты и AI" title="Отчёты, экспорт и AI-рекомендации" description="Важные цифры перед глазами. Больше понимания — больше уверенности в решениях." />
      <div className={p.reportsGrid}>
        <article className={p.panel} data-scroll-reveal><div className={p.panelHeading}><h3>Отчёты</h3><span className={p.example}>Сентябрь 2026 · пример</span><button className={p.exportButton} onClick={exportReport} type="button"><Download size={13} /> Скачать CSV</button></div><table className={p.dataTable}><thead><tr><th>Показатель</th><th>Значение</th><th>Изменение</th></tr></thead><tbody>{reportRows.map(row => <tr key={row[0]}><td>{row[0]}</td><td><strong>{row[1]}</strong></td><td className={p.positive}>↗ {row[2]}</td></tr>)}</tbody></table><p className={p.exportStatus} role="status">{exported ? "Пример отчёта скачан. CSV открывается в Excel." : "Скачайте пример отчёта и откройте его в Excel."}</p></article>
        <article className={`${p.panel} ${p.recommendation}`} data-scroll-reveal><div className={p.panelHeading}><h3><Sparkles size={22} /> Shanyraq AI</h3><span className={p.example}>В разработке</span></div><p>На следующие выходные ожидается высокая загрузка. Рекомендуем <strong>увеличить тариф на 8–12%.</strong></p><div className={p.recommendationBottom}><span>Пример рекомендации</span><button type="button" aria-label="Подробнее о рекомендации" aria-expanded={showRecommendation} onClick={() => setShowRecommendation(!showRecommendation)}><ArrowRight size={20} /></button></div>{showRecommendation && <div className={p.recommendationDetails}>В рекомендации будут учитываться загрузка объекта, даты и динамика бронирований. Решение об изменении цены всегда остаётся за вами.</div>}</article>
      </div>
    </section>
  </div>;
}

export function HotelFinalCta() {
  return <section className={p.hotelCta} data-scroll-reveal><div className={s.container}><ShieldCheck size={28} /><h2>Готовы управлять объектом проще?</h2><p>Больше времени для гостей. Больше возможностей для вашего бизнеса.</p><Link className={s.primaryButton} href="/register">Попробовать Shanyraq AI <ArrowRight size={17} /></Link><small><Check size={13} />Бесплатно на время бета-теста · Карта не требуется</small></div></section>;
}
