import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const out = [];
const push = (value) => out.push(value);
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const C = {
  canvas: "#E9EEEA",
  phone: "#F8FAF7",
  white: "#FFFFFF",
  ink: "#18231F",
  muted: "#718079",
  green: "#0B8068",
  greenDark: "#075647",
  mint: "#DDF2EA",
  mint2: "#ECF8F3",
  sand: "#E6D2A7",
  sandSoft: "#FBF2DC",
  sky: "#6FA5E8",
  skySoft: "#E8F1FD",
  coral: "#E96C66",
  coralSoft: "#FDE9E6",
  amber: "#EBAA35",
  amberSoft: "#FFF0CC",
  line: "#E5EAE6",
};

function rect(x, y, w, h, fill = C.white, r = 18, extra = "") {
  push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`);
}

function text(x, y, value, size = 14, weight = 500, fill = C.ink, anchor = "start", extra = "") {
  push(`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${esc(value)}</text>`);
}

function line(x1, y1, x2, y2, stroke = C.line, width = 1, extra = "") {
  push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`);
}

function chip(x, y, label, fill = C.mint, color = C.greenDark, width) {
  const w = width ?? Math.max(58, label.length * 7 + 24);
  rect(x, y, w, 30, fill, 15);
  text(x + w / 2, y + 20, label, 12, 700, color, "middle");
  return w;
}

function button(x, y, w, label, fill = C.green, color = C.white) {
  rect(x, y, w, 48, fill, 13);
  text(x + w / 2, y + 30, label, 14, 750, color, "middle");
  push(`<path d="M ${x + w - 35} ${y + 10} q 12 7 0 14 q -12 7 0 14" fill="none" stroke="${C.sand}" stroke-width="1.2" opacity=".32"/>`);
}

function shanyraq(cx, cy, r = 42, opacity = 0.1) {
  push(`<g id="shanyraq-motif" fill="none" stroke="${C.sand}" stroke-width="3" opacity="${opacity}">`);
  push(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`);
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    const x2 = cx + Math.cos(a) * r;
    const y2 = cy + Math.sin(a) * r;
    push(`<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`);
  }
  push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.42}"/>`);
  push(`</g>`);
}

function ornament(x, y, width, opacity = 0.18) {
  push(`<g id="qoshqar-muyiz-detail" fill="none" stroke="${C.sand}" stroke-width="2" opacity="${opacity}">`);
  push(`<path d="M ${x} ${y} q 12 -14 24 0 q 12 14 24 0 q 12 -14 24 0 q 12 14 24 0"/>`);
  push(`<path d="M ${x + width - 96} ${y} q 12 -14 24 0 q 12 14 24 0 q 12 -14 24 0 q 12 14 24 0"/>`);
  push(`</g>`);
}

function iconUse(name, x, y, color = C.muted, scale = 1) {
  push(`<use href="#icon-${name}" x="${x}" y="${y}" width="24" height="24" color="${color}" transform="translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})"/>`);
}

function bottomNav(active = "Обзор") {
  const items = [
    ["home", "Обзор", 58],
    ["calendar", "Календарь", 157],
    ["booking", "Брони", 257],
    ["more", "Ещё", 354],
  ];
  rect(0, 838, 400, 82, C.white, 0);
  line(0, 838, 400, 838);
  for (const [icon, label, x] of items) {
    const selected = label === active;
    if (selected) {
      push(`<circle cx="${x}" cy="862" r="18" fill="${C.mint2}"/>`);
      shanyraq(x, 862, 11, 0.55);
    }
    iconUse(icon, x - 10, 852, selected ? C.green : C.muted, 0.84);
    text(x, 899, label, 10, selected ? 750 : 500, selected ? C.green : C.muted, "middle");
  }
}

function screen(index, x, y, title, subtitle, active, body) {
  push(`<g id="screen-${String(index).padStart(2, "0")}-${title.toLowerCase().replaceAll(" ", "-")}" transform="translate(${x} ${y})">`);
  rect(0, 0, 400, 920, C.phone, 36, `stroke="#DDE4DF" stroke-width="1"`);
  text(22, 28, "9:41", 12, 750);
  push(`<g id="status-icons" fill="none" stroke="${C.ink}" stroke-width="2"><path d="M346 19h4m4 0h4m4 0h4"/><rect x="372" y="13" width="17" height="10" rx="3"/><rect x="389" y="16" width="3" height="4" rx="1" fill="${C.ink}"/><rect x="374" y="15" width="11" height="6" rx="1" fill="${C.ink}"/></g>`);
  text(22, 71, title, title.length > 17 ? 24 : 28, 800);
  text(22, 94, subtitle, 12, 500, C.muted);
  shanyraq(340, 105, 38, 0.11);
  push(`<g id="content">`);
  body();
  push(`</g>`);
  bottomNav(active);
  push(`</g>`);
}

function metricCard(x, y, w, label, value, accent = C.green) {
  rect(x, y, w, 94, C.white, 18);
  text(x + 15, y + 26, label, 12, 600, C.muted);
  text(x + 15, y + 61, value, 25, 800);
  push(`<circle cx="${x + w - 19}" cy="${y + 20}" r="5" fill="${accent}" opacity=".28"/>`);
}

function personRow(x, y, name, sub, badge, tint = C.mint2, badgeFill = C.mint) {
  rect(x, y, 356, 70, C.white, 17);
  push(`<circle cx="${x + 28}" cy="${y + 35}" r="19" fill="${tint}"/>`);
  text(x + 28, y + 40, "12", 11, 800, C.greenDark, "middle");
  text(x + 58, y + 29, name, 13, 750);
  text(x + 58, y + 50, sub, 10, 500, C.muted);
  chip(x + 274, y + 20, badge, badgeFill, C.greenDark, 66);
}

function menuRow(y, icon, title, sub = "") {
  rect(22, y, 356, 64, C.white, 16);
  iconUse(icon, 38, y + 20, C.green, 0.85);
  text(76, y + 28, title, 14, 750);
  if (sub) text(76, y + 47, sub, 10, 500, C.muted);
  text(357, y + 38, "›", 23, 500, C.muted, "middle");
}

function roomRow(y, room, place, state, tint, stateFill) {
  rect(22, y, 356, 72, C.white, 17);
  rect(34, y + 14, 46, 44, tint, 13);
  iconUse("bed", 45, y + 24, C.greenDark, 0.8);
  text(94, y + 28, room, 14, 800);
  text(94, y + 48, place, 10, 500, C.muted);
  chip(299, y + 20, state, stateFill, C.greenDark, 62);
}

function sectionTitle(y, label, action = "") {
  text(22, y, label, 15, 800);
  if (action) text(378, y, action, 12, 750, C.green, "end");
}

push(`<?xml version="1.0" encoding="UTF-8"?>`);
push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1440" height="4160" viewBox="0 0 1440 4160">`);
push(`<title>Shanyraq Mobile — editable Kazakh redesign</title>`);
push(`<desc>Editable vector UI kit with twelve grouped mobile screens for import into Figma.</desc>`);
push(`<defs>`);
push(`<linearGradient id="steppeGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B8068"/><stop offset="1" stop-color="#075647"/></linearGradient>`);
push(`<linearGradient id="feltGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBFAF5"/><stop offset="1" stop-color="#F3EFE4"/></linearGradient>`);
push(`<symbol id="icon-home" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>`);
push(`<symbol id="icon-calendar" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 3v4m10-4v4M3 10h18" stroke="currentColor" stroke-width="1.8"/></symbol>`);
push(`<symbol id="icon-booking" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>`);
push(`<symbol id="icon-more" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></symbol>`);
push(`<symbol id="icon-guest" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 21c.7-5 3.3-7 8-7s7.3 2 8 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>`);
push(`<symbol id="icon-bed" viewBox="0 0 24 24"><path d="M3 18v-8m18 8v-5a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3v5M3 16h18M7 10V7h5a3 3 0 0 1 3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>`);
push(`<symbol id="icon-chart" viewBox="0 0 24 24"><path d="M5 20V10m7 10V4m7 16v-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>`);
push(`<style>text{font-family:Inter,Arial,sans-serif;letter-spacing:-0.15px}.screen-label{font-size:12px;font-weight:700;fill:#718079}</style>`);
push(`</defs>`);
rect(0, 0, 1440, 4160, C.canvas, 0);

push(`<g id="board-header">`);
text(40, 50, "SHANYRAQ MOBILE · EDITABLE SVG UI KIT", 28, 850);
text(40, 81, "12 экранов · современный Казахстан · мобильный PMS", 14, 550, C.muted);
text(40, 111, "Шанырақ — символ дома. Степь — пространство. Интерфейс — ясность.", 14, 700, C.green);
const swatches = [[C.green,"Степной зелёный"],[C.ink,"Чернильный"],[C.sand,"Тёплый войлок"],[C.sky,"Небесный"],[C.coral,"Ошибка"]];
swatches.forEach(([color,label],i)=>{ const x=820+i*115; push(`<circle cx="${x}" cy="46" r="13" fill="${color}"/>`); text(x,76,label,10,600,C.muted,"middle"); });
push(`</g>`);

const X = [40, 520, 1000];
const Y = [170, 1140, 2110, 3080];

screen(1, X[0], Y[0], "Обзор", "Сегодня, 26 сентября", "Обзор", () => {
  push(`<g id="income-card">`); rect(22, 118, 356, 126, "url(#steppeGradient)", 22); text(42, 150, "Доход в сентябре", 13, 650, "#D7F5E9"); text(42, 193, "4 820 000 ₸", 32, 850, C.white); text(42, 222, "+12% к августу", 12, 700, "#B9EDB6"); chip(294,132,"Отчёт",C.white,C.greenDark,66); push(`<path d="M22 228 C95 205 125 235 193 216 S309 190 378 215 V244 H22Z" fill="${C.sand}" opacity=".22"/>`); ornament(250,226,110,.35); push(`</g>`);
  sectionTitle(280,"Сегодня","Все задачи"); metricCard(22,296,108,"Заезды","4",C.green); metricCard(146,296,108,"Выезды","3",C.sky); metricCard(270,296,108,"К уборке","5",C.amber);
  sectionTitle(430,"Требует внимания"); rect(22,446,356,72,C.coralSoft,17); push(`<circle cx="50" cy="482" r="18" fill="${C.coral}"/>`); text(50,488,"!",18,800,C.white,"middle"); text(80,474,"Конфликт бронирований",13,800); text(80,495,"A-12 · 28–30 сентября",10,500,C.muted); chip(298,467,"Решить",C.white,C.coral,62);
  sectionTitle(555,"Ближайшие гости","Календарь"); personRow(22,571,"Айдана С.","A-03 · сегодня, 14:00","Оплачено"); personRow(22,651,"Максим Т.","B-11 · сегодня, 16:30","Депозит",C.skySoft,C.sandSoft); button(22,752,356,"＋ Новая бронь",C.ink);
});

screen(2, X[1], Y[0], "Календарь", "Шахматка · 18 объектов", "Календарь", () => {
  rect(22,118,356,48,C.white,15); chip(30,127,"Неделя",C.green,C.white,82); text(171,149,"Месяц",12,650,C.muted,"middle"); text(271,149,"Фильтры",12,650,C.muted,"middle"); text(354,149,"⌄",15,700,C.muted,"middle");
  sectionTitle(205,"22–28 сентября","Сегодня"); ["Пн\n22","Вт\n23","Ср\n24","Чт\n25","Пт\n26","Сб\n27","Вс\n28"].forEach((d,i)=>{ const [a,b]=d.split("\n"); text(40+i*50,232,a,10,600,C.muted,"middle"); if(b==="26") push(`<circle cx="${40+i*50}" cy="253" r="17" fill="${C.green}"/>`); text(40+i*50,258,b,11,750,b==="26"?C.white:C.ink,"middle"); });
  const rows=[["A-03","Алматы","Айдана · 3н",C.green,100,72],["A-12","Алматы","Конфликт",C.coral,174,66],["B-11","Астана","Booking · 4н",C.sky,118,94],["C-02","Шымкент","Hold",C.amber,252,62],["D-07","Боровое","Airbnb", "#7E62B8",172,72]];
  rows.forEach((r,i)=>{ const y=290+i*94; rect(22,y,356,76,C.white,16); text(34,y+29,r[0],12,800); text(34,y+49,r[1],9,500,C.muted); for(let k=0;k<7;k++) line(102+k*39,y+10,102+k*39,y+66,"#EEF1EF"); rect(r[4],y+17,r[5],42,r[3],11); text(r[4]+r[5]/2,y+43,r[2],11,750,C.white,"middle"); });
  rect(22,775,356,45,C.white,14); push(`<circle cx="42" cy="798" r="6" fill="${C.green}"/><circle cx="142" cy="798" r="6" fill="${C.coral}"/><circle cx="237" cy="798" r="6" fill="${C.amber}"/>`); text(56,802,"Свободно 12",10,650); text(156,802,"Риск 1",10,650); text(251,802,"Блок 2",10,650);
});

screen(3, X[2], Y[0], "Брони", "24 активных", "Брони", () => {
  rect(22,118,356,48,C.white,15); text(48,148,"⌕",21,500,C.muted); text(76,147,"Поиск гостя или номера",11,500,C.muted); chip(304,127,"Фильтры",C.mint2,C.greenDark,66);
  chip(22,184,"Все 24",C.green,C.white,72); chip(102,184,"Заезды 4",C.white,C.muted,78); chip(188,184,"Выезды 3",C.white,C.muted,82); chip(278,184,"Не оплачено 5",C.white,C.muted,100);
  sectionTitle(242,"Сегодня"); personRow(22,258,"Айдана Сарсенова","A-03 · 26–29 сен","Заезд"); personRow(22,338,"Максим Титов","B-11 · 26–30 сен","Заезд",C.skySoft,C.mint); personRow(22,418,"Жанна К.","C-02 · 22–26 сен","Выезд",C.mint2,C.skySoft);
  text(360,493,"30 000 ₸ долг",10,750,C.coral,"end"); sectionTitle(535,"Завтра"); personRow(22,551,"Данияр Д.","D-07 · 27–29 сен","Ostrovok",C.sandSoft,C.skySoft); push(`<circle cx="349" cy="755" r="28" fill="${C.green}"/>`); text(349,763,"+",29,400,C.white,"middle");
});

screen(4, X[0], Y[1], "Гости", "1 284 профиля", "Ещё", () => {
  rect(22,118,356,48,C.white,15); text(48,148,"⌕",21,500,C.muted); text(76,147,"Имя, телефон или ИИН",11,500,C.muted);
  rect(22,182,356,102,"url(#steppeGradient)",20); text(42,212,"Повторные гости",12,650,"#D7F5E9"); text(42,253,"38%",32,850,C.white); text(108,251,"+6% за 30 дней",11,700,"#B9EDB6"); chip(303,199,"CRM",C.white,C.greenDark,58);
  sectionTitle(326,"Недавние","Сегменты"); personRow(22,342,"Айдана Сарсенова","+7 701 *** 18 42 · 5 поездок","›"); personRow(22,422,"Максим Титов","+7 777 *** 05 11 · 2 поездки","›",C.skySoft,C.white); personRow(22,502,"Жанна Касымова","+7 705 *** 33 26 · Новый гость","›",C.sandSoft,C.white); personRow(22,582,"Дина Рахимова","+7 747 *** 70 90 · 3 поездки","›",C.coralSoft,C.white); button(22,752,356,"＋ Добавить гостя",C.ink);
});

screen(5, X[1], Y[1], "Номера", "18 объектов · 14 готовы", "Ещё", () => {
  rect(22,118,356,94,C.white,18); text(42,148,"Готовность сегодня",12,650,C.muted); text(42,188,"14 / 18",28,850); rect(155,168,190,10,"#E8EEEA",5); rect(155,168,148,10,C.green,5); text(348,148,"78%",12,800,C.green,"end");
  chip(22,230,"Все 18",C.green,C.white,70); chip(100,230,"Готовы 14",C.white,C.muted,82); chip(190,230,"Уборка 3",C.white,C.muted,78); chip(276,230,"Ремонт 1",C.white,C.muted,80);
  roomRow(282,"A-03","Алматы · Абая 109","Готово",C.mint2,C.mint); roomRow(364,"A-12","Алматы · Достык 42","Уборка",C.sandSoft,C.amberSoft); roomRow(446,"B-11","Астана · Мәңгілік Ел 35","Занят",C.skySoft,C.skySoft); roomRow(528,"C-02","Шымкент · Тауке хана 8","Ремонт",C.coralSoft,C.coralSoft); roomRow(610,"D-07","Боровое · Кенесары 12","Готово",C.mint2,C.mint);
});

screen(6, X[2], Y[1], "Отчёты", "Сентябрь 2026", "Ещё", () => {
  rect(22,118,356,48,C.white,15); text(42,148,"‹",22,600,C.muted); text(200,148,"Сентябрь 2026",13,750,C.ink,"middle"); text(358,148,"›",22,600,C.muted,"middle");
  metricCard(22,184,108,"Доход","4,82 млн ₸",C.green); metricCard(146,184,108,"Загрузка","76%",C.sky); metricCard(270,184,108,"ADR","42 600 ₸",C.amber);
  sectionTitle(326,"Доход по неделям"); rect(22,342,356,246,"url(#feltGradient)",20); push(`<path d="M22 528 C85 510 125 532 185 498 S296 450 378 472 V588 H22Z" fill="${C.mint}" opacity=".55"/>`); shanyraq(196,443,45,.12); const bars=[68,112,88,145,128,172,158]; bars.forEach((h,i)=>{rect(52+i*43,550-h,24,h,C.green,6);text(64+i*43,572,String(1+i*4),9,600,C.muted,"middle");});
  sectionTitle(630,"Каналы"); [[C.green,"Прямые","2 160 000 ₸","45%"],[C.sky,"Booking.com","1 540 000 ₸","32%"],["#7658B0","Airbnb","720 000 ₸","15%"],[C.amber,"Другое","400 000 ₸","8%"]].forEach((r,i)=>{const y=662+i*39;push(`<circle cx="33" cy="${y-4}" r="6" fill="${r[0]}"/>`);text(49,y,r[1],11,650);text(328,y,r[2],11,750,C.ink,"end");text(378,y,r[3],10,650,C.muted,"end");});
});

screen(7, X[0], Y[2], "Ещё", "Управление и сервисы", "Ещё", () => {
  rect(22,118,356,94,"url(#steppeGradient)",20); push(`<circle cx="62" cy="165" r="25" fill="${C.white}" opacity=".94"/>`); text(62,171,"SH",13,850,C.green,"middle"); text(102,154,"Shanyraq Apartments",15,800,C.white); text(102,177,"18 объектов · Business",11,600,"#D7F5E9"); text(356,171,"›",24,500,C.white,"middle"); ornament(248,197,110,.35);
  sectionTitle(252,"Операции"); menuRow(268,"guest","Гости","CRM и история поездок"); menuRow(342,"bed","Номера","Готовность и обслуживание"); menuRow(416,"calendar","Задачи и уборка","5 активных · 1 просрочена");
  sectionTitle(522,"Бизнес"); menuRow(538,"chart","Отчёты","Доход, загрузка, каналы"); menuRow(612,"booking","Платежи","5 неоплаченных броней"); sectionTitle(718,"Система"); menuRow(734,"more","Настройки","Объекты, команда, интеграции");
});

screen(8, X[1], Y[2], "Настройки", "Shanyraq Apartments", "Ещё", () => {
  sectionTitle(132,"Компания"); menuRow(148,"home","Компания","Реквизиты, часовой пояс"); sectionTitle(252,"Управление"); menuRow(268,"bed","Объекты и номера","18 активных"); menuRow(342,"guest","Команда и роли","7 сотрудников"); menuRow(416,"booking","Правила проживания","Заезд, выезд, депозит"); sectionTitle(522,"Продажи"); menuRow(538,"calendar","Каналы","Booking.com, Airbnb +2"); menuRow(612,"chart","Цены и налоги","KZT · НДС не указан"); menuRow(686,"more","Уведомления","Push, WhatsApp, email"); text(200,792,"Выйти из аккаунта",13,750,C.coral,"middle");
});

screen(9, X[2], Y[2], "Новая бронь", "Шаг 1 из 3 · Даты и объект", "Брони", () => {
  rect(22,112,356,5,"#E6ECE8",3); rect(22,112,118,5,C.green,3); sectionTitle(153,"Даты проживания"); rect(22,169,356,92,C.white,18); text(42,197,"Заезд",10,650,C.muted); text(42,226,"26 сен · 14:00",14,800); text(212,197,"Выезд",10,650,C.muted); text(212,226,"29 сен · 12:00",14,800); line(195,184,195,244);
  sectionTitle(306,"Гости"); rect(22,322,356,68,C.white,17); text(42,363,"2 взрослых · 0 детей",14,750); text(310,363,"−   2   +",17,750,C.green,"middle");
  sectionTitle(435,"Свободные объекты"); [["A-03","Алматы · 3 ночи","126 000 ₸",true],["C-02","Шымкент · 3 ночи","108 000 ₸",false],["D-07","Боровое · 3 ночи","144 000 ₸",false]].forEach((r,i)=>{const y=451+i*83;rect(22,y,356,70,r[3]?C.mint2:C.white,17,`stroke="${r[3]?C.green:C.line}" stroke-width="${r[3]?2:1}"`);push(`<circle cx="48" cy="${y+35}" r="13" fill="${r[3]?C.green:C.white}" stroke="${r[3]?C.green:'#CAD3CD'}" stroke-width="2"/>`);if(r[3])text(48,y+40,"✓",12,800,C.white,"middle");text(72,y+29,r[0],14,800);text(72,y+49,r[1],10,500,C.muted);text(358,y+40,r[2],12,800,C.ink,"end");});
  sectionTitle(682,"Источник"); rect(22,698,356,52,C.white,15); text(42,730,"Прямая бронь",13,700); text(354,730,"⌄",15,700,C.muted,"middle"); button(22,766,356,"Продолжить");
});

screen(10, X[0], Y[3], "Бронь #SH-2841", "Айдана Сарсенова", "Брони", () => {
  chip(22,116,"Подтверждена",C.mint,C.greenDark,108); chip(140,116,"Оплачено",C.skySoft,C.sky,82); text(366,138,"•••",16,750,C.muted,"end");
  rect(22,164,356,116,C.white,18); text(42,196,"A-03 · Алматы",15,800); text(42,222,"26 сен, 14:00 → 29 сен, 12:00",11,500,C.muted); text(42,259,"3 ночи · 2 гостя",11,700); text(358,259,"126 000 ₸",14,850,C.ink,"end");
  [["Позвонить","☎"],["Написать","✉"],["Заселить","✓"]].forEach((r,i)=>{const x=22+i*120;rect(x,298,112,70,C.white,16);text(x+56,326,r[1],17,700,C.green,"middle");text(x+56,352,r[0],11,750,C.green,"middle");});
  sectionTitle(413,"Оплата"); rect(22,429,356,130,C.white,18); text(42,462,"Итого",11,600,C.muted); text(358,462,"126 000 ₸",12,800,C.ink,"end"); text(42,490,"Оплачено",11,600,C.muted); text(358,490,"126 000 ₸",12,800,C.green,"end"); text(42,528,"Депозит",11,600,C.muted); text(358,528,"30 000 ₸ · наличные",12,800,C.ink,"end");
  sectionTitle(605,"Детали гостя"); rect(22,621,356,112,C.white,18); text(42,654,"Телефон",11,600,C.muted); text(358,654,"+7 701 *** 18 42",11,750,C.ink,"end"); text(42,683,"Комментарий",11,600,C.muted); text(358,683,"Поздний заезд",11,750,C.ink,"end"); text(42,712,"Документ",11,600,C.muted); text(358,712,"Проверен",11,750,C.green,"end"); button(22,772,356,"Изменить бронь",C.ink);
});

screen(11, X[1], Y[3], "Состояния", "Пусто · загрузка · ошибка", "Ещё", () => {
  rect(22,118,356,188,C.white,20); push(`<circle cx="200" cy="163" r="30" fill="${C.mint}"/>`); shanyraq(200,163,15,.65); text(200,218,"Броней пока нет",16,800,C.ink,"middle"); text(200,242,"Создайте первую бронь или измените фильтры",10,500,C.muted,"middle"); chip(155,258,"Новая бронь",C.green,C.white,90);
  text(22,348,"Загрузка",13,750,C.muted); rect(22,364,356,116,C.white,18); [0,1,2,3].forEach(i=>rect(42,384+i*20,236-i*28,10,"#EEF1EF",5));
  text(22,524,"Нет сети",13,750,C.muted); rect(22,540,356,120,C.amberSoft,18); push(`<circle cx="56" cy="578" r="19" fill="${C.amber}"/>`); text(56,584,"!",16,850,C.white,"middle"); text(88,575,"Работаем офлайн",14,800); text(88,598,"Изменения синхронизируются позже",10,500,C.muted); chip(286,611,"Повторить",C.white,C.ink,76);
  text(22,704,"Ошибка синхронизации",13,750,C.muted); rect(22,720,356,72,C.coralSoft,18); push(`<circle cx="56" cy="756" r="18" fill="${C.coral}"/>`); text(56,762,"↕",15,850,C.white,"middle"); text(86,751,"Booking.com не обновлён",13,800); text(86,772,"Повторите сейчас",10,600,C.coral);
});

screen(12, X[2], Y[3], "Фильтры броней", "Bottom sheet / form state", "Брони", () => {
  line(160,118,240,118,"#D6DDD8",6,`stroke-linecap="round"`); sectionTitle(163,"Фильтры","Сбросить"); text(22,207,"Статус",12,750); chip(22,221,"Подтверждена",C.mint,C.greenDark,108); chip(140,221,"Ожидает",C.white,C.muted,78); chip(226,221,"Отменена",C.white,C.muted,82);
  text(22,292,"Период",12,750); rect(22,308,356,62,"#F1F4F1",15); text(42,346,"26 сен — 30 сен",13,750); iconUse("calendar",336,327,C.green,.75);
  text(22,420,"Источник",12,750); [["Все каналы",true],["Прямые",false],["Booking.com",false],["Airbnb",false]].forEach((r,i)=>{const y=448+i*48;push(`<circle cx="36" cy="${y}" r="10" fill="${r[1]?C.green:C.white}" stroke="${r[1]?C.green:'#C8D1CB'}" stroke-width="2"/>`);if(r[1])push(`<circle cx="36" cy="${y}" r="4" fill="${C.white}"/>`);text(58,y+5,r[0],13,650);});
  text(22,670,"Оплата",12,750); rect(22,686,356,62,"#F1F4F1",15); text(42,724,"Есть задолженность",13,700); rect(322,705,42,24,C.green,12); push(`<circle cx="352" cy="717" r="9" fill="${C.white}"/>`); button(22,780,356,"Показать 8 броней");
});

push(`<g id="board-footer">`);
text(40, 4072, "Векторная система: каждый экран, текст, карточка, кнопка и мотив остаются редактируемыми после импорта в Figma.", 14, 650, C.muted);
text(1400, 4072, "SHANYRAQ · 2026", 14, 800, C.green, "end");
push(`</g>`);
push(`</svg>`);

const outputPath = join(dirname(fileURLToPath(import.meta.url)), "shanyraq-mobile-kazakh-editable.svg");
writeFileSync(outputPath, out.join("\n"), "utf8");
console.log(outputPath);
