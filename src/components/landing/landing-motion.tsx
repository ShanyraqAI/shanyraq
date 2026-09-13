"use client";

import { useEffect, useRef, type ReactNode } from "react";
import s from "./landing.module.css";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

export function LandingMotion({ children, className }: { children: ReactNode; className: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scene = container.querySelector<HTMLElement>("[data-laptop-scene]");
    const lid = container.querySelector<HTMLElement>("[data-laptop-lid]");
    const laptop = container.querySelector<HTMLElement>("[data-laptop]");
    const screen = container.querySelector<HTMLElement>("[data-laptop-screen]");
    const screenContent = container.querySelector<HTMLElement>("[data-screen-content]");
    const header = container.querySelector<HTMLElement>("header");
    const intro = container.querySelector<HTMLElement>("[data-hero-intro]");
    const closed = container.querySelector<HTMLElement>("[data-closed-message]");
    const hint = container.querySelector<HTMLElement>("[data-hero-hint]");
    const prompt = container.querySelector<HTMLElement>("[data-scroll-prompt]");
    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-flying-card]"));
    const reveals = Array.from(container.querySelectorAll<HTMLElement>(`[data-scroll-reveal], .${s.sectionHeading}, .${s.priceCard}, .${s.securityGrid}, .${s.faqList}, footer`));
    const activeReveals = new Set<HTMLElement>();
    let frame = 0;
    let current = 0;
    let previousTime = 0;

    // Animate from actual scroll position without intercepting wheel, touch or keyboard input.
    function render(time: number) {
      frame = 0;
      if (!scene || !lid || !laptop || !screen) return;
      const rect = scene.getBoundingClientRect();
      const travel = Math.max(1, scene.offsetHeight - (scene.firstElementChild as HTMLElement).offsetHeight);
      const target = reduced.matches ? 0 : clamp(-rect.top / travel);
      const elapsed = Math.min(time - previousTime || 16, 64);
      previousTime = time;
      current += (target - current) * (1 - Math.exp(-elapsed / 75));
      if (Math.abs(current - target) < .0005) current = target;
      const progress = smooth(clamp((current - .08) / .84));
      lid.style.transform = `rotateX(${-90 * progress}deg)`;
      laptop.style.transform = `translate3d(0, ${-130 * progress}px, 0) scale(${1 - .18 * progress}) rotateX(-12deg)`;
      if (header) header.dataset.scrolled = String(window.scrollY > 30);
      screen.style.opacity = String(1 - smooth(clamp((progress - .72) / .28)));
      const unavailable = progress > .65;
      screen.inert = unavailable;
      screen.style.pointerEvents = unavailable ? "none" : "auto";
      if (intro) { intro.style.opacity = String(1 - smooth(clamp(current / .46))); intro.style.transform = `translateY(${-70 * progress}px)`; intro.inert = current > .42; }
      if (hint) hint.style.opacity = String(1 - clamp(current * 5));
      if (prompt) prompt.style.opacity = String(1 - clamp(current * 3));
      if (closed) { closed.style.opacity = String(smooth(clamp((current - .52) / .35))); closed.style.transform = `translateY(${25 * (1 - progress)}px)`; closed.inert = current < .6; }
      cards.forEach((card, index) => {
        const side = card.dataset.flyingCard === "left" ? -1 : 1;
        const flight = smooth(clamp(current / .8));
        const arc = Math.sin(flight * Math.PI);
        card.style.transform = `translate3d(${side * (flight * 140 + arc * 24)}px, ${-flight * (130 + index * 19) - arc * 45}px, 0) rotate(${side * (-3 + flight * 14)}deg) scale(${1 - flight * .18})`;
        card.style.opacity = String(1 - smooth(clamp((current - .12) / .52)));
      });
      activeReveals.forEach(element => {
        const top = element.getBoundingClientRect().top;
        const amount = reduced.matches || element.contains(document.activeElement) ? 1 : smooth(clamp((window.innerHeight - top - 15) / Math.min(230, window.innerHeight * .3)));
        element.style.opacity = String(.15 + amount * .85);
        element.style.translate = `0 ${(1 - amount) * 35}px`;
        element.style.setProperty("--reveal", String(amount));
      });
      if (current !== target) frame = requestAnimationFrame(render);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(render); }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const element = entry.target as HTMLElement;
        if (entry.isIntersecting) activeReveals.add(element);
        else { activeReveals.delete(element); element.style.opacity = "1"; element.style.translate = "none"; }
      });
      schedule();
    }, { rootMargin: "100px 0px" });
    reveals.forEach(element => observer.observe(element));
    function configure() {
      if (reduced.matches) {
        current = 0;
        reveals.forEach(element => { element.style.opacity = "1"; element.style.translate = "none"; element.style.setProperty("--reveal", "1"); });
      }
      schedule();
    }
    const resize = new ResizeObserver(() => {
      if (screen && screenContent) screenContent.style.zoom = String(screen.clientWidth / 800);
      if (laptop && lid) laptop.style.setProperty("--device-depth", `${lid.offsetHeight}px`);
      schedule();
    });
    resize.observe(container);
    if (screen) resize.observe(screen);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    container.addEventListener("focusin", schedule);
    reduced.addEventListener("change", configure);
    configure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      container.removeEventListener("focusin", schedule);
      reduced.removeEventListener("change", configure);
    };
  }, []);

  return <div ref={root} className={className}>{children}</div>;
}
