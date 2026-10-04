import Image from "next/image";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronRight, LogIn, LogOut, MousePointer2, Play, Sparkles } from "lucide-react";
import { BetaTrigger } from "./beta-trigger";
import { CalendarZoom } from "./calendar-zoom";
import { CalendarPreview } from "./calendar-preview";
import { BrandLogo } from "@/components/shared/brand-logo";
import s from "./landing.module.css";
import p from "./premium.module.css";

export function TrendLine({ large = false }: { large?: boolean }) {
  return <svg className={large ? p.largeChart : p.sparkline} viewBox="0 0 320 110" fill="none" role="img" aria-label="График роста загрузки за сентябрь">
    <path d="M0 98C18 98 22 77 39 81S61 87 78 73S100 65 115 68S139 41 158 47S181 20 199 28S218 57 239 37S260 48 280 29S302 24 320 7V110H0Z" fill="#dce9df" opacity=".7" />
    <path d="M0 94C27 95 25 90 46 89S76 55 96 65S120 76 140 58S170 51 187 42S211 32 229 32S244 45 263 31S290 40 320 22" stroke="#a4bcaa" strokeWidth="1.7" />
    <path data-chart-line d="M0 98C18 98 22 77 39 81S61 87 78 73S100 65 115 68S139 41 158 47S181 20 199 28S218 57 239 37S260 48 280 29S302 24 320 7" stroke="#245c46" strokeWidth="2.3" strokeLinecap="round" pathLength="1" />
  </svg>;
}

export function LaptopHero() {
  return <section className={p.heroScene} data-laptop-scene aria-labelledby="hero-title">
    <div className={p.heroSticky}>
      <div className={p.heroBackdrop}><Image src="/brand/hotel-lobby.webp" alt="" fill priority unoptimized sizes="100vw" /></div>
      <div className={p.heroVeil} />
      <div className={p.heroIntro} data-hero-intro>
        <div className={s.eyebrow}><span className={s.statusDot} /> Управление отелем без хаоса</div>
        <h1 id="hero-title">Управляйте отелем<br /><span>из одного окна</span></h1>
        <p>Бронирования, номера, гости, оплаты и каналы — в единой системе.</p>
        <div className={s.heroActions}>
          <BetaTrigger className={s.primaryButton}>Попробовать бесплатно <ArrowRight size={16} /></BetaTrigger>
          <a href="#demo" className={s.secondaryButton}><Play size={17} /> Смотреть демо</a>
        </div>
        <div className={s.trialNote}><Check size={13} /> Бесплатно на время бета-теста <span>·</span> Карта не требуется</div>
      </div>

      <div className={p.stage} id="demo" data-laptop-stage>
        <div className={p.laptop} data-laptop>
          <div className={p.laptopLid} data-laptop-lid>
            <div className={p.camera} />
            <div className={p.screen} data-laptop-screen><div className={p.screenContent} data-screen-content><CalendarPreview inLaptop /></div></div>
            <div className={p.screenReflection} aria-hidden="true" />
            <div className={p.lidBrand} aria-hidden="true">SHANYRAQ AI</div>
            <div className={p.lidBack} aria-hidden="true" />
          </div>
          <div className={p.laptopDeck} aria-hidden="true"><div className={p.keyboard} /><div className={p.trackpad} /></div>
          <div className={p.laptopBase} aria-hidden="true"><span /></div>
          <div className={p.laptopShadow} aria-hidden="true" />
        </div>

        <div className={`${p.notification} ${p.occupancy}`} data-flying-card="left" aria-hidden="true"><span>Загрузка</span><strong>84%</strong><TrendLine /><small><ArrowUpRight size={13} /> <b>12%</b> к прошлому месяцу</small></div>
        <div className={`${p.notification} ${p.arrivals}`} data-flying-card="left" aria-hidden="true"><span>Сегодня</span><p><LogIn size={19} /><span>Заезды</span><strong>7</strong></p><p><LogOut size={19} /><span>Выезды</span><strong>4</strong></p></div>
        <div className={`${p.notification} ${p.newBooking}`} data-flying-card="right" aria-hidden="true"><span>Новая бронь</span><div className={p.bookingNotification}><b className={p.bookingIcon}>B</b><p><strong>Booking.com</strong><span>Номер 204</span><small>12–15 сентября</small></p><ChevronRight size={17} /></div></div>
        <div className={`${p.notification} ${p.revenue}`} data-flying-card="right" aria-hidden="true"><span>Выручка</span><strong>₸ 1 284 000</strong><small><ArrowUpRight size={14} /> <b>18.4%</b></small><div className={p.miniBars}>{[12, 20, 30, 42].map(h => <i key={h} style={{ height: h }} />)}</div></div>
        <div className={`${p.notification} ${p.aiNotice}`} data-flying-card="right" aria-hidden="true"><span><Sparkles size={19} /> <b>Shanyraq AI</b></span><p>Найден риск<br /><strong>овербукинга</strong></p><ChevronRight size={17} /></div>
      </div>
      <CalendarZoom />
      <div className={p.interactionHint} data-hero-hint><MousePointer2 size={13} /> Нажмите на бронь в календаре — откроется карточка гостя</div>
      <div className={p.scrollPrompt} data-scroll-prompt><span>Всё это — в одном пространстве</span><ArrowDown size={20} /></div>
      <div className={p.closedMessage} data-closed-message><BrandLogo variant="mark" style={{ width: 34, height: 34 }} /><p>Всё под контролем.<br /><strong>Даже когда ноутбук закрыт.</strong></p><a href="#features" aria-label="К возможностям"><ArrowDown size={20} /></a></div>
    </div>
  </section>;
}
