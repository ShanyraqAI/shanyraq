import Link from "next/link";
import { ArrowRight, ArrowUpRight, BedDouble, CalendarCheck2, CalendarDays, Check, CircleCheck, ClipboardList, FileSpreadsheet, FolderCheck, KeyRound, LockKeyhole, LogIn, MessageCircle, MessagesSquare, Plus, ShieldCheck, Sparkles, Upload, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarPreview } from "./calendar-preview";
import s from "./landing.module.css";

export function SectionHeading({ eyebrow, title, description, centered = false }: { eyebrow: string; title: string; description?: string; centered?: boolean }) {
  return <div className={`${s.sectionHeading} ${centered ? s.centered : ""}`}><span className={s.sectionEyebrow}>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}

export function ProblemsSection() {
  const problems = [
    { icon: MessagesSquare, title: "Данные разбросаны" },
    { icon: CalendarDays, title: "Возможны накладки" },
    { icon: Wallet, title: "Сложно сверять оплаты" },
  ];
  return <section className={`${s.section} ${s.container}`} aria-labelledby="problems-heading"><div className={s.problemHeading}><span className={s.sectionEyebrow}>Проблема большинства объектов</span><h2 id="problems-heading">Ручной учёт усложняет управление</h2><p>С этим сталкиваются многие владельцы до перехода на единую систему.</p></div><div className={s.problemGrid}>{problems.map(({ icon: Icon, title }) => <article className={s.problemCard} key={title}><Icon size={21} strokeWidth={1.5} /><h3>{title}</h3></article>)}</div></section>;
}

export function FeaturesSection() {
  const features = [
    { icon: CalendarDays, title: "Умный календарь", text: "Создавайте, переносите и отменяйте брони в несколько кликов." },
    { icon: BedDouble, title: "Номера и квартиры", text: "Персональные названия, вместимость, цены и статусы." },
    { icon: Users, title: "Гости", text: "Контакты, история проживаний и важные заметки." },
    { icon: Wallet, title: "Оплаты", text: "Сумма брони, предоплата, остаток и задолженность." },
    { icon: LogIn, title: "Заезды и выезды", text: "Важные задачи на сегодня всегда перед глазами." },
    { icon: FileSpreadsheet, title: "Импорт из Excel", text: "Перенесите существующие брони без ручной переписи." },
  ];
  return <section id="features" className={`${s.section} ${s.featuresSection}`}><div className={s.container}><SectionHeading centered eyebrow="Один сервис вместо десятка инструментов" title="Всё необходимое для ежедневной работы объекта" description="От первой брони до выезда гостя — понятно вам и вашей команде." /><div className={s.featuresGrid}>{features.map(({ icon: Icon, title, text }) => <article className={s.featureCard} key={title}><div className={s.featureCopy}><Icon size={19} strokeWidth={1.6} /><h3>{title}</h3><p>{text}</p></div></article>)}</div></div></section>;
}

export function CalendarSection() {
  return <section id="demo" className={`${s.section} ${s.calendarSection}`}><div className={s.container}><SectionHeading centered eyebrow="Порядок виден сразу" title="Контролируйте загрузку всех квартир за несколько секунд" description="Свободные даты, ближайшие заезды и статус каждой оплаты — на одном экране." /><div className={s.demoFrame}><CalendarPreview /></div><div className={s.calendarCallouts}>{[{ icon: CalendarCheck2, text: "Свободные даты" }, { icon: Plus, text: "Новая бронь" }, { icon: Wallet, text: "Контроль оплат" }, { icon: LogIn, text: "Заезд сегодня" }].map(({ icon: Icon, text }) => <span key={text}><Icon size={15} />{text}</span>)}</div><p className={s.demoNote}>Это интерактивный пример. Выберите бронь, чтобы посмотреть карточку гостя.</p></div></section>;
}

export function ExcelSection() {
  return <section className={`${s.section} ${s.container} ${s.excelSection}`}><div><SectionHeading eyebrow="Начните с того, что уже есть" title="Переходите из Excel без стресса" description="Загрузите таблицу с бронированиями, проверьте данные перед импортом — и продолжайте работу в удобном календаре Shanyraq AI." /><a className={s.textLink} href="/register">Перенести бронирования <ArrowRight size={17} /></a></div><div className={s.importVisual}><div className={s.importFile}><span><FileSpreadsheet size={20} /> Бронирования.xlsx</span><Upload size={17} /></div><div className={s.importTable} aria-label="Пример таблицы для импорта"><div><span>Гость</span><span>Квартира</span><span>Заезд</span><span>Сумма</span></div>{[["Айгерим С.", "Студия 101", "07.09.26", "75 000 ₸"], ["Данияр А.", "Апарт. 204", "08.09.26", "120 000 ₸"], ["Асель Т.", "Студия 103", "08.09.26", "66 000 ₸"]].map((row) => <div key={row[0]}>{row.map((value) => <span key={value}>{value}</span>)}</div>)}</div><div className={s.importFlow}><span><FileSpreadsheet size={18} /><strong>Excel-таблица</strong></span><ArrowRight size={15} /><span><FolderCheck size={18} /><strong>Проверка данных</strong></span><ArrowRight size={15} /><span><CalendarCheck2 size={18} /><strong>Календарь Shanyraq AI</strong></span></div><p><CircleCheck size={13} /> Вы проверяете данные до импорта</p></div></section>;
}

export function SecuritySection() {
  const items = [
    { icon: KeyRound, title: "Защищённый доступ", text: "Доступ к сервису получают только авторизованные пользователи." },
    { icon: LockKeyhole, title: "Конфиденциальность данных", text: "Информация о вашем объекте, гостях и бронированиях доступна только вам и вашей команде." },
    { icon: ShieldCheck, title: "Надёжная работа", text: "Мы постоянно развиваем Shanyraq AI, чтобы сервис оставался стабильным и удобным для ежедневной работы." },
  ];
  return <section id="security" className={`${s.section} ${s.securitySection}`}><div className={s.container}><div className={s.securitySeal}><ShieldCheck size={32} strokeWidth={1.3} /></div><SectionHeading centered eyebrow="Спокойствие — часть сервиса" title="Ваши данные — под надёжной защитой" description="Shanyraq AI создан для безопасной работы с бронированиями, гостями и данными вашего объекта." /><div className={s.securityGrid}>{items.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={23} strokeWidth={1.4} /><h3>{title}</h3><p>{text}</p></article>)}</div><p className={s.securityNote}>Безопасность и конфиденциальность данных — один из наших главных приоритетов.</p></div></section>;
}

export function StepsSection() {
  const steps = [{ icon: BedDouble, title: "Создайте объект", text: "Добавьте свои квартиры или номера." }, { icon: ClipboardList, title: "Перенесите брони", text: "Импортируйте Excel или создайте первую бронь вручную." }, { icon: CalendarCheck2, title: "Управляйте в одном окне", text: "Следите за загрузкой, гостями, оплатами и задачами." }];
  return <section className={`${s.section} ${s.container}`}><SectionHeading centered eyebrow="Всего три простых шага" title="Больше порядка — уже с первого дня" /><ol className={s.stepsGrid}>{steps.map(({ icon: Icon, title, text }, i) => <li key={title}><div className={s.stepNumber}>0{i + 1}<Icon size={23} strokeWidth={1.3} /></div><h3>{title}</h3><p>{text}</p></li>)}</ol></section>;
}

export function RoadmapSection() {
  return <section className={`${s.section} ${s.container}`}><SectionHeading centered eyebrow="Следующая глава" title="Shanyraq AI развивается вместе с вашим бизнесом" description="Добавляем возможности, которые освобождают время для самого важного." /><div className={s.roadmapGrid}>{[{ icon: CalendarCheck2, title: "Интеграции с каналами бронирования", status: "В разработке", text: "Больше каналов. Одна система управления." }, { icon: MessageCircle, title: "Автоматические сообщения гостям", status: "Скоро", text: "Важная информация — в нужный момент." }, { icon: Sparkles, title: "Рекомендации по ценам", status: "В разработке", text: "Больше данных для ваших решений." }].map(({ icon: Icon, title, status, text }) => <article key={title}><div><Icon size={22} strokeWidth={1.4} /><span>{status}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>;
}

export function FaqSection() {
  const faqs = [
    ["Подойдёт ли Shanyraq AI, если у меня только 1–2 квартиры?", "Да. Тариф Start рассчитан на владельцев до 3 квартир или номеров. Вы сможете вести бронирования, гостей и оплаты в одном календаре и выбрать более вместительный тариф, когда ваш бизнес вырастет."],
    ["Можно ли перенести брони из Excel?", "Да. Загрузите таблицу с бронированиями, проверьте данные перед импортом и перенесите их в календарь. Повторно вносить каждую бронь вручную не придётся."],
    ["Можно ли добавить администратора или сотрудника?", "Да. Работа с сотрудниками предусмотрена в тарифах Pro и Business. В Business также доступно расширенное управление доступом."],
    ["Есть ли бесплатный период?", "Да, 14 дней бесплатного доступа. Банковская карта для начала не нужна. За это время можно добавить объект и разобраться с ежедневной работой в сервисе."],
    ["Можно ли работать с телефона?", "Да. Shanyraq AI доступен в браузере телефона, планшета и компьютера. Можно проверить бронирования и ближайшие заезды, даже когда вы не за рабочим столом."],
    ["Как защищаются данные?", "Доступ к данным вашего объекта получают только авторизованные пользователи вашей команды. Безопасность и конфиденциальность — один из наших главных приоритетов. Если у вас есть вопросы, напишите на hello@shanyraq.ai."],
    ["Когда появятся Booking.com и Ostrovok?", "Мы работаем над интеграциями с популярными каналами бронирования. О доступности новых функций будем сообщать пользователям Shanyraq AI."],
  ];
  return <section id="faq" className={`${s.section} ${s.container} ${s.faqSection}`}><div><SectionHeading eyebrow="Отвечаем на ваши вопросы" title="Осталось что-то уточнить?" /><p className={s.faqContact}>Мы рядом и готовы помочь.<br /><a href="mailto:hello@shanyraq.ai">hello@shanyraq.ai <ArrowUpRight size={14} /></a></p></div><div className={s.faqList}>{faqs.map(([question, answer]) => <details key={question} name="landing-faq"><summary>{question}<Plus size={17} /></summary><p>{answer}</p></details>)}</div></section>;
}

export function FinalCta() {
  return <section className={`${s.container} ${s.finalCta}`}><div className={s.eyebrow}><span className={s.statusDot} /> Время для вашего бизнеса</div><h2>Меньше таблиц.<br /><span>Больше контроля над бизнесом.</span></h2><p>Создайте объект в Shanyraq AI и приведите бронирования,<br className={s.desktopBreak} /> гостей и оплаты в порядок уже сегодня.</p><Button asChild className={s.primaryButton}><Link href="/register">Попробовать бесплатно <ArrowUpRight /></Link></Button><small>14 дней бесплатно · Карта не требуется</small></section>;
}
