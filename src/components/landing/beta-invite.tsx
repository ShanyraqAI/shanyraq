"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, LoaderCircle, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BrandLogo } from "@/components/shared/brand-logo";
import { clarityEvent } from "@/lib/analytics/clarity";
import p from "./beta-invite.module.css";

const BetaContext = createContext<() => void>(() => {});
export const useBetaInvite = () => useContext(BetaContext);
const seenKey = "shanyraq-beta-invite-seen";

export function BetaInvite({ children, className }: { children: ReactNode; className: string }) {
  const [step, setStep] = useState<"offer" | "form" | "success" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const dismissed = useRef(false);
  const markSeen = useCallback(() => {
    dismissed.current = true;
    try { sessionStorage.setItem(seenKey, "1"); } catch { /* Storage may be disabled; the in-memory guard still applies. */ }
  }, []);
  const openForm = useCallback(() => { markSeen(); clarityEvent("beta_form_opened"); setStep("form"); }, [markSeen]);

  useEffect(() => {
    try { if (sessionStorage.getItem(seenKey)) return; } catch { /* Show once for this page when storage is unavailable. */ }
    let timer: ReturnType<typeof setTimeout>;
    function show() {
      if (dismissed.current) return;
      // Avoid interrupting another dialog, an open menu, or a contact field.
      if (document.hidden || document.querySelector('[role="dialog"], details[open]') || document.activeElement?.matches("input, textarea, select")) {
        timer = setTimeout(show, 1000);
        return;
      }
      markSeen();
      clarityEvent("beta_offer_shown");
      setStep("offer");
    }
    timer = setTimeout(show, 30_000);
    return () => clearTimeout(timer);
  }, [markSeen]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const contact = String(data.get("contact") ?? "").trim();
    const property = String(data.get("property") ?? "").trim();
    if (!name || contact.length < 5) { setError("Укажите имя и телефон или email для связи."); return; }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/support/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "LANDING", sourcePath: "/#beta", name, contact, message: `Заявка на бесплатный бета-тест Shanyraq AI. Объект: ${property || "Не указан"}. Прошу связаться со мной для подключения.`, transcript: [] }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить заявку. Попробуйте ещё раз.");
      setReference(result.reference);
      clarityEvent("beta_form_submitted");
      setStep("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Нет связи с сервером. Попробуйте ещё раз.");
    } finally { setPending(false); }
  }

  return <BetaContext.Provider value={openForm}>{children}
    <Dialog open={step !== null} onOpenChange={open => { if (!open && !pending) { markSeen(); setStep(null); } }}>
      <DialogContent showCloseButton={!pending} className={`${className} ${p.dialog} ${step === "offer" ? p.offer : ""}`} onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => { if (pending) event.preventDefault(); }}>
        {step === "offer" ? <>
          <div className={p.offerCopy}><span className={p.badge}><Sparkles size={13} /> BETA TEST</span><DialogTitle className={p.title}>Ваш отель.<br />Новый уровень спокойствия.</DialogTitle><DialogDescription className={p.description}>Приглашаем в бета-тест Shanyraq AI. Бронирования, гости и оплаты — в одном месте. <strong>Пока идёт бета-тест, всё бесплатно.</strong></DialogDescription><button className={p.primary} onClick={openForm}>Оставить заявку <ArrowRight size={17} /></button><span className={p.note}><Check size={13} /> Без оплаты и банковской карты</span></div>
          <div className={p.offerArt} aria-hidden="true"><div className={p.orbit} /><div className={p.orbit} /><BrandLogo variant="mark" inverse /><span className={p.artCard}>Всё под контролем <Check size={14} /></span><span className={p.artPrice}>0 ₸ <small>на время бета-теста</small></span></div>
        </> : step === "success" ? <div className={p.success}><span><Check size={28} /></span><DialogTitle className={p.title}>Заявка сохранена</DialogTitle><DialogDescription className={p.description}>Свяжемся с вами по указанному контакту и поможем начать работу. На время бета-теста всё бесплатно.</DialogDescription><p>Номер заявки: {reference}</p><button className={p.primary} onClick={() => setStep(null)}>Понятно <Check size={16} /></button></div> : <>
          <span className={p.badge}>BETA TEST · 0 ₸ / месяц</span><DialogTitle className={p.title}>Начнём с вашего объекта</DialogTitle><DialogDescription className={p.description}>Оставьте контакт — поможем подключиться. Все тарифы бесплатны на время бета-теста.</DialogDescription>
          <form onSubmit={submit} className={p.form} aria-busy={pending}>
            <label>Ваше имя<input name="name" autoComplete="name" autoFocus placeholder="Как к вам обращаться" required maxLength={100} disabled={pending} /></label>
            <label>Телефон или email<input name="contact" autoComplete="email" placeholder="+7 … или name@example.com" required minLength={5} maxLength={160} disabled={pending} /></label>
            <label>Ваш объект <span>необязательно</span><input name="property" autoComplete="organization" placeholder="Название отеля или количество квартир" maxLength={200} disabled={pending} /></label>
            <p className={p.privacy}>Используем контакт только для связи по вашей заявке.</p>
            {error && <p role="alert" className={p.error}>{error}</p>}
            <button type="submit" className={p.primary} disabled={pending}>{pending ? <><LoaderCircle size={16} className={p.spinner} /> Сохраняем заявку…</> : <>Отправить заявку бесплатно <ArrowRight size={16} /></>}</button>
          </form>
        </>}
      </DialogContent>
    </Dialog>
  </BetaContext.Provider>;
}
