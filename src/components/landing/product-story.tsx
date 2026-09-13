"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, CircleCheck, Download, Search, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { TrendLine } from "./laptop-hero";
import p from "./premium.module.css";
import s from "./landing.module.css";

const guests = [
  { name: "Анна Ким", room: "204", dates: "12–15 сен", status: "Заезд", total: "284 000", stays: 3 },
  { name: "Иван Петров", room: "101", dates: "11–13 сен", status: "Проживает", total: "120 000", stays: 2 },
  { name: "Ольга Садыкова", room: "203", dates: "10–12 сен", status: "Выезд", total: "96 000", stays: 1 },
  { name: "Сергей Новиков", room: "201", dates: "14–18 сен", status: "Подтверждено", total: "192 000", stays: 4 },
  { name: "Дмитрий Волков", room: "202", dates: "13–16 сен", status: "Подтверждено", total: "144 000", stays: 2 },
];
const reportRows = [["Выручка", "₸ 1 284 000", "18.4%"], ["Загрузка", "84%", "12%"], ["ADR", "₸ 24 800", "9.1%"], ["RevPAR", "₸ 20 832", "15.6%"]];

function StoryHeading({ number, label, title, description }: { number: string; label: string; title: string; description: string }) {
  return <div className={p.storyHeading} data-scroll-reveal><span className={p.sectionPill}><b>{number}</b>{label}</span><h2>{title}</h2><p>{description}</p></div>;
}

export function ProductStory() {
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Все статусы");
  const [roomType, setRoomType] = useState("Все типы");
  const [rateType, setRateType] = useState("Делюкс");
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [exported, setExported] = useState(false);
  const guest = guests[selected];
  const visibleGuests = guests.filter(g => g.name.toLowerCase().includes(query.toLowerCase()) && (status === "Все статусы" || g.status === status));

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
      <div className={p.operationsGrid}>
        <article className={`${p.panel} ${p.reservationsPanel}`} data-scroll-reveal>
          <div className={p.panelHeading}><h3>Бронирования</h3><span className={p.example}>Пример данных</span></div>
          <div className={p.filters}><select aria-label="Статус бронирования" value={status} onChange={e => setStatus(e.target.value)}>{["Все статусы", "Заезд", "Проживает", "Выезд", "Подтверждено"].map(value => <option key={value}>{value}</option>)}</select><label><Search size={13} /><input aria-label="Поиск гостя" placeholder="Поиск гостя…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
          <div className={p.tableScroll}><table className={p.dataTable}><thead><tr><th>№</th><th>Гость</th><th>Номер</th><th>Даты</th><th>Статус</th></tr></thead><tbody>{visibleGuests.map(g => <tr key={g.name} data-selected={guest.name === g.name}><td>#{4582 - guests.indexOf(g)}</td><td><button type="button" onClick={() => setSelected(guests.indexOf(g))} aria-pressed={guest.name === g.name}>{g.name}</button></td><td>{g.room}</td><td>{g.dates}</td><td><span className={g.status === "Выезд" ? p.orangeBadge : p.greenBadge}>{g.status}</span></td></tr>)}</tbody></table></div>
          {!visibleGuests.length && <p className={p.emptyState}>Гости не найдены. Измените поиск или статус.</p>}
          <p className={p.panelFootnote}>Выберите гостя, чтобы посмотреть его историю <ArrowRight size={12} /></p>
        </article>
        <article className={p.panel} data-scroll-reveal>
          <div className={p.panelHeading}><h3>Номера</h3><select aria-label="Тип номера" value={roomType} onChange={e => setRoomType(e.target.value)}>{["Все типы", "Стандарт", "Делюкс"].map(v => <option key={v}>{v}</option>)}</select></div>
          <div className={p.roomLegend}><span><i />Свободен</span><span><i />Занят</span><span><i />Уборка</span></div>
          {["101", "102", "201", "202", "301"].filter(room => roomType === "Все типы" || (room.startsWith("2") ? "Делюкс" : "Стандарт") === roomType).map((room, i) => <div className={p.roomRow} key={room}><div><strong>{room}</strong><small>{room.startsWith("2") ? "Делюкс" : "Стандарт"}</small></div><span className={i % 3 === 0 ? p.orangeBadge : p.greenBadge}>{i % 3 === 0 ? "Уборка" : "Готов"}</span><i style={{ background: i % 2 ? "#d88b94" : "#378266" }} aria-label={i % 2 ? "Занят" : "Свободен"} /></div>)}
        </article>
        <article className={`${p.panel} ${p.guestCard}`} data-scroll-reveal aria-live="polite">
          <div className={p.panelHeading}><h3>Гость</h3><span className={p.example}>Карточка гостя</span></div>
          <div className={p.guestIdentity}><span><UserRound size={25} /></span><div><h4>{guest.name}</h4><p>Постоянный гость</p><small>Номер {guest.room}</small></div></div>
          <div className={p.guestStats}><div><strong>{guest.stays}</strong><span>проживания</span></div><div><strong>₸ {guest.total}</strong><span>общая сумма</span></div></div>
          <div className={p.guestHistoryTitle}>История проживаний</div><table className={p.dataTable}><thead><tr><th>Даты</th><th>Номер</th><th>Статус</th></tr></thead><tbody><tr><td>{guest.dates} 2026</td><td>{guest.room}</td><td><span className={p.greenBadge}>{guest.status}</span></td></tr><tr><td>03–06 авг 2026</td><td>201</td><td>Завершён</td></tr><tr><td>12–14 июн 2026</td><td>101</td><td>Завершён</td></tr></tbody></table>
        </article>
      </div>
    </section>

    <section className={`${s.container} ${p.storySection}`}>
      <StoryHeading number="02" label="Тарифы и аналитика" title="Тарифы и загрузка под вашим контролем" description="Управляйте ценами, следите за загрузкой и ключевыми показателями в реальном времени." />
      <div className={p.analyticsGrid}>
        <article className={p.panel} data-scroll-reveal><div className={p.panelHeading}><h3>Тарифы</h3><span className={p.example}>Пример</span></div><div className={p.filters}><select aria-label="Категория тарифа" value={rateType} onChange={e => setRateType(e.target.value)}><option>Делюкс</option><option>Стандарт</option></select><span>Сентябрь 2026 <ChevronDown size={12} /></span></div><table className={p.dataTable}><thead><tr><th>Дата</th><th>Базовый тариф</th><th>Итоговая цена</th></tr></thead><tbody>{[13, 14, 15, 16].map((day, i) => <tr key={day}><td>{day} сен</td><td>₸ {rateType === "Делюкс" ? "24 000" : "16 000"}</td><td><strong>₸ {rateType === "Делюкс" ? (i === 1 || i === 2 ? "28 800" : "24 000") : (i === 1 || i === 2 ? "19 200" : "16 000")}</strong></td></tr>)}</tbody></table></article>
        <article className={`${p.panel} ${p.chartPanel}`} data-scroll-reveal><div className={p.panelHeading}><h3>Загрузка</h3><span className={p.example}>Сентябрь</span></div><div className={p.chartValue}>84% <span><ArrowUpRight size={15} />12%</span></div><TrendLine large /><div className={p.chartDates}><span>1 сен</span><span>7 сен</span><span>14 сен</span><span>21 сен</span><span>30 сен</span></div><div className={p.chartLegend}><span><i />Текущий период</span><span><i />Прошлый период</span></div></article>
        <article className={p.panel} data-scroll-reveal><div className={p.panelHeading}><h3>Ключевые показатели</h3></div>{reportRows.filter(row => row[0] !== "Загрузка").map(row => <div className={p.metricRow} key={row[0]}><span>{row[0]}</span><div><strong>{row[1]}</strong><small><ArrowUpRight size={13} />{row[2]}</small></div></div>)}</article>
      </div>
    </section>

    <section className={`${s.container} ${p.storySection}`} id="channels">
      <StoryHeading number="03" label="Каналы" title="Все каналы. Один календарь." description="Бронирования с популярных площадок — в Shanyraq AI. Единая картина загрузки вашего объекта." />
      <div className={p.channelFlow} data-scroll-reveal>
        <div className={p.channelList}>{[["B", "Booking.com", p.bookingIcon], ["O", "Ostrovok.ru", p.ostrovokIcon], ["K", "Krisha.kz", p.krishaIcon]].map(([letter, name, cls]) => <div key={name}><b className={cls}>{letter}</b><p><strong>{name}</strong><small>Интеграция в разработке</small></p><span className={p.channelDot} /></div>)}</div>
        <div className={p.connector} aria-hidden="true"><svg viewBox="0 0 160 180" fill="none"><path d="M0 25 C90 25 45 90 160 90M0 90H160M0 155C90 155 45 90 160 90" /></svg><span /></div>
        <div className={p.channelHub}><BrandLogo style={{ width: 190, height: 40 }} /></div>
        <div className={`${p.connector} ${p.shortConnector}`} aria-hidden="true"><svg viewBox="0 0 160 180" fill="none"><path d="M0 90H160" /></svg><span /></div>
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
  return <section className={p.hotelCta} data-scroll-reveal><div className={s.container}><ShieldCheck size={28} /><h2>Готовы управлять объектом проще?</h2><p>Больше времени для гостей. Больше возможностей для вашего бизнеса.</p><Link className={s.primaryButton} href="/register">Попробовать Shanyraq AI <ArrowRight size={17} /></Link><small><Check size={13} />14 дней бесплатно · Карта не требуется</small></div></section>;
}
