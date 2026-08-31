"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, BedDouble, CalendarDays, Check, ChevronDown, CircleHelp, CreditCard, LayoutDashboard, LogIn, Plus, Settings2, Users, Wallet } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import s from "./landing.module.css";

const apartments = ["ЖК «Новые высоты»", "Апартаменты 204", "ЖК «Сезим»", "Студия на Абая", "Апартаменты 305"];
const bookings = [
  { id: 1, row: 0, start: 0, span: 3, name: "Айгерим С.", fullName: "Айгерим Садыкова", initials: "АС", color: "green", amount: "75 000", dates: "7–10 сентября", paid: true },
  { id: 2, row: 0, start: 4, span: 3, name: "Марат К.", fullName: "Марат Касымов", initials: "МК", color: "sand", amount: "90 000", dates: "11–14 сентября", paid: false },
  { id: 3, row: 1, start: 1, span: 4, name: "Данияр А.", fullName: "Данияр Ахметов", initials: "ДА", color: "blue", amount: "120 000", dates: "8–12 сентября", paid: true },
  { id: 4, row: 2, start: 0, span: 2, name: "Алина М.", fullName: "Алина Мусина", initials: "АМ", color: "sand", amount: "48 000", dates: "7–9 сентября", paid: false },
  { id: 5, row: 2, start: 3, span: 4, name: "Сергей В.", fullName: "Сергей Волков", initials: "СВ", color: "green", amount: "96 000", dates: "10–14 сентября", paid: true },
  { id: 6, row: 3, start: 1, span: 3, name: "Асель Т.", fullName: "Асель Турсунова", initials: "АТ", color: "green", amount: "66 000", dates: "8–11 сентября", paid: true },
  { id: 7, row: 4, start: 0, span: 4, name: "Тимур Б.", fullName: "Тимур Беков", initials: "ТБ", color: "blue", amount: "100 000", dates: "7–11 сентября", paid: true },
  { id: 8, row: 4, start: 5, span: 2, name: "Елена П.", fullName: "Елена Петрова", initials: "ЕП", color: "sand", amount: "50 000", dates: "12–14 сентября", paid: false },
];

export function CalendarPreview({ compact = false }: { compact?: boolean }) {
  const [selectedId, setSelectedId] = useState(3);
  const selected = bookings.find((booking) => booking.id === selectedId)!;
  return (
    <div className={`${s.productPreview} ${compact ? s.compactPreview : s.fullPreview}`}>
      <div className={s.previewChrome}><span /><span /><span /><p>shanyraq.ai <span>/</span> ваш объект</p><span className={s.exampleLabel}>Демонстрационные данные</span></div>
      <div className={s.productBody}>
        <aside className={s.productSidebar} aria-label="Разделы интерфейса на иллюстрации">
          <div className={s.productBrand}><BrandLogo inverse style={{ width: "100%", height: 23 }} /></div>
          <div className={s.propertyName}>Alma Apartments<ChevronDown size={12} /><small>Алматы · 12 квартир</small></div>
          {[{ icon: LayoutDashboard, name: "Обзор" }, { icon: CalendarDays, name: "Календарь" }, { icon: BedDouble, name: "Квартиры" }, { icon: Users, name: "Гости" }, { icon: Wallet, name: "Оплаты" }].map(({ icon: Icon, name }) => <div key={name} className={`${s.sidebarItem} ${name === "Календарь" ? s.sidebarActive : ""}`}><Icon size={15} />{name}</div>)}
          <div className={s.sidebarBottom}><div className={s.sidebarItem}><CircleHelp size={15} />Помощь</div><div className={s.sidebarItem}><Settings2 size={15} />Настройки</div><div className={s.ownerAvatar}><span>АК</span><p>Алия К.<small>Владелец объекта</small></p></div></div>
        </aside>
        <div className={s.productMain}>
          <div className={s.productTitle}><div><span>Всё под контролем</span><h3>Календарь бронирований</h3></div><Link href="/register" className={s.previewNew}><Plus size={13} /><span>Новая бронь</span></Link></div>
          <div className={s.productMetrics}>
            <div><span><BedDouble size={14} /> Загрузка</span><strong>83<small>%</small></strong><p>10 из 12 квартир занято</p><div className={s.meter}><i /></div></div>
            <div><span><Wallet size={14} /> Выручка за месяц</span><strong>2 375 000 <small>₸</small></strong><p className={s.metricPositive}><ArrowUpRight size={12} /> +18% к прошлому месяцу</p></div>
            <div><span><LogIn size={14} /> Заезды сегодня</span><strong>3 <small>гостя</small></strong><p>Ближайший заезд — 14:00</p></div>
          </div>
          <div className={s.calendarToolbar}><strong>7–13 сентября <span>2026</span></strong><span>Неделя <ChevronDown size={11} /></span></div>
          <div className={s.calendarAndGuest}>
            <div className={s.calendarScroll} role="region" aria-label="Календарь на неделю, демонстрационные данные" tabIndex={0}>
              <div className={s.calendarGrid}>
                <div className={s.gridCorner}>Квартира <ChevronDown size={10} /></div>
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, index) => <div key={day} className={`${s.dayHeader} ${index === 1 ? s.today : ""}`} style={{ gridColumn: index + 2, gridRow: 1 }}><span>{day}</span><strong>{index + 7}</strong></div>)}
                {apartments.map((name, row) => <div className={s.apartmentCell} style={{ gridColumn: 1, gridRow: row + 2 }} key={name}><span>{name}</span><small>{row % 2 ? "2 гостя · студия" : "4 гостя · 2 комнаты"}</small></div>)}
                {apartments.flatMap((_, row) => Array.from({ length: 7 }, (_, col) => <div key={`${row}-${col}`} aria-hidden="true" className={`${s.emptyCell} ${col === 1 ? s.todayCell : ""}`} style={{ gridColumn: col + 2, gridRow: row + 2 }} />))}
                {bookings.map((booking) => <button key={booking.id} type="button" aria-pressed={selectedId === booking.id} aria-label={`${booking.fullName}, ${booking.dates}, ${booking.paid ? "Оплачено" : "Предоплата"}`} onClick={() => setSelectedId(booking.id)} className={`${s.booking} ${s[booking.color]} ${selectedId === booking.id ? s.selectedBooking : ""}`} style={{ gridColumn: `${booking.start + 2} / span ${booking.span}`, gridRow: booking.row + 2 }}><span>{booking.name}</span><small>{booking.paid ? <Check size={10} /> : <CreditCard size={10} />}{booking.amount} ₸</small></button>)}
              </div>
            </div>
            {!compact && <aside className={s.guestPanel} aria-live="polite"><div className={s.guestPanelTop}>Бронирование <span>#{String(selected.id).padStart(4, "0")}</span></div><div className={s.guestAvatar}>{selected.initials}</div><h4>{selected.fullName}</h4><p>Прямая бронь</p><dl><div><dt>Квартира</dt><dd>{apartments[selected.row]}</dd></div><div><dt>Даты проживания</dt><dd>{selected.dates}</dd></div><div><dt>Сумма бронирования</dt><dd>{selected.amount} ₸</dd></div></dl><span className={s.paymentStatus}><Check size={13} />{selected.paid ? "Оплачено" : "Предоплата"}</span><Link href="/register">Управлять своими бронями <ArrowUpRight size={14} /></Link></aside>}
          </div>
          <div className={s.calendarLegend}><span><i className={s.greenDot} />Оплачено</span><span><i className={s.sandDot} />Предоплата</span><span className={s.calendarHint}>Нажмите на бронь, чтобы посмотреть детали</span></div>
        </div>
      </div>
      {compact && <><div className={s.floatingCheck}><span><Check size={18} /></span><div>Оплата получена<strong>+ 75 000 ₸</strong></div><ArrowDownLeft size={16} /></div><div className={s.floatingGuest} aria-live="polite"><div className={s.floatingGuestHead}><span className={s.guestAvatar}>{selected.initials}</span><div><strong>{selected.fullName}</strong><small>{selected.dates}</small></div></div><div className={s.floatingGuestStatus}><span><span className={s.statusDot} /> {selected.paid ? "Оплачено" : "Предоплата"}</span><span>Заезд в 14:00</span></div></div></>}
    </div>
  );
}
