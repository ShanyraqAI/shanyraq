"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Search, UserRound } from "lucide-react";
import p from "./premium.module.css";

const reservations = [
  { id: "T54CP8Y", name: "Aigerim Serikbay", room: "101", start: "10 авг", end: "11 авг", nights: 1, channel: "Прямые брони", color: "#759367", amount: 25000, status: "Подтверждено" },
  { id: "13S0D7ZR", name: "Almas Dzhenissov", room: "101", start: "12 авг", end: "14 авг", nights: 2, channel: "Прямые брони", color: "#759367", amount: 50000, status: "Выселен" },
  { id: "9006Z0BA", name: "John Smith", room: "102", start: "15 авг", end: "18 авг", nights: 3, channel: "Booking.com", color: "#064598", amount: 82000, status: "Выселен" },
  { id: "FAY440Y9", name: "Gulnara Karimova", room: "301", start: "15 авг", end: "23 авг", nights: 8, channel: "Прямые брони", color: "#759367", amount: 574000, status: "Заселён" },
  { id: "EIED6P6T", name: "Maria Gonzalez", room: "201", start: "16 авг", end: "19 авг", nights: 3, channel: "Ostrovok", color: "#ff9600", amount: 119500, status: "Выселен" },
];
const money = (amount: number) => new Intl.NumberFormat("ru-KZ").format(amount);

export function ReservationsShowcase() {
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Все статусы");
  const [roomType, setRoomType] = useState("Все типы");
  const guest = reservations[selected];
  const visible = reservations.filter(g => g.name.toLowerCase().includes(query.toLowerCase()) && (status === "Все статусы" || g.status === status));

  return <div className={p.operationsGrid}>
    <article className={`${p.panel} ${p.reservationsPanel}`} data-scroll-reveal>
      <div className={p.panelHeading}><h3>Бронирования</h3><span className={p.example}>Пример данных</span></div>
      <div className={p.reservationToolbar}><p><b>{visible.length}</b> бронирований <span><b>₸ {money(visible.reduce((sum, g) => sum + g.amount, 0))}</b> забронировано</span></p><Link href="/register"><Plus size={14} /> Новая бронь</Link></div>
      <div className={p.filters}><select aria-label="Статус бронирования" value={status} onChange={e => setStatus(e.target.value)}>{["Все статусы", "Подтверждено", "Заселён", "Выселен"].map(value => <option key={value}>{value}</option>)}</select><label><Search size={13} /><input aria-label="Поиск гостя" placeholder="Поиск гостя…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
      <div className={p.tableScroll}><table className={`${p.dataTable} ${p.reservationsTable}`}><thead><tr>{["ID", "Гость", "Номер", "Даты", "Канал", "Сумма", "Статус"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(g => <tr key={g.id} data-selected={guest.id === g.id}><td>#{g.id}</td><td><button type="button" onClick={() => setSelected(reservations.indexOf(g))} aria-pressed={guest.id === g.id}>{g.name}</button></td><td>{g.room}</td><td>{g.start} → {g.end}</td><td><span className={p.channelLabel}><i style={{ background: g.color }} />{g.channel}</span></td><td>{money(g.amount)} ₸</td><td><span className={p.greenBadge}>{g.status}</span></td></tr>)}</tbody></table></div>
      {!visible.length && <p className={p.emptyState}>Гости не найдены. Измените поиск или статус.</p>}
      <p className={p.panelFootnote}>Нажмите на имя — откроется карточка бронирования <ArrowRight size={12} /></p>
    </article>
    <article className={`${p.panel} ${p.reservationDetail}`} data-scroll-reveal aria-live="polite">
      <div className={p.panelHeading}><h3>Бронирование <span>#{guest.id}</span></h3><span className={p.greenBadge}>{guest.status}</span></div>
      <p className={p.createdDate}>Создано 9 августа 2026 · пример данных</p>
      <div className={p.guestIdentity}><span><UserRound size={21} /></span><div><h4>{guest.name}</h4><p>{guest.name.toLowerCase().split(" ")[0]}@example.com</p><small>+7 700 000 00 00</small></div></div>
      <dl className={p.reservationFacts}><div><dt>Номер</dt><dd>{guest.room} · {guest.room.startsWith("2") ? "Делюкс" : "Стандарт"}</dd></div><div><dt>Гости</dt><dd>2 взрослых, 1 ребёнок</dd></div><div><dt>Канал</dt><dd className={p.channelLabel}><i style={{ background: guest.color }} />{guest.channel}</dd></div><div><dt>Заезд</dt><dd>{guest.start} 2026</dd></div><div><dt>Выезд</dt><dd>{guest.end} 2026</dd></div><div><dt>Ночей</dt><dd>{guest.nights}</dd></div></dl>
      <div className={p.reservationTotal}><span>Итого</span><strong>{money(guest.amount)} KZT</strong></div>
      <Link className={p.manageReservation} href="/register">Управлять своими бронированиями <ArrowRight size={15} /></Link>
    </article>
    <article className={`${p.panel} ${p.roomsPanel}`} data-scroll-reveal>
      <div className={p.panelHeading}><h3>Номера</h3><select aria-label="Тип номера" value={roomType} onChange={e => setRoomType(e.target.value)}>{["Все типы", "Стандарт", "Делюкс"].map(v => <option key={v}>{v}</option>)}</select></div>
      <div className={p.roomTiles}>{["101", "102", "201", "202", "301"].filter(room => roomType === "Все типы" || (room.startsWith("2") ? "Делюкс" : "Стандарт") === roomType).map((room, i) => <div className={p.roomRow} key={room}><div><strong>{room}</strong><small>{room.startsWith("2") ? "Делюкс" : "Стандарт"}</small></div><span className={i % 3 === 0 ? p.orangeBadge : p.greenBadge}>{i % 3 === 0 ? "Уборка" : "Готов"}</span></div>)}</div>
    </article>
  </div>;
}
