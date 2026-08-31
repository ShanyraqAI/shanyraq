"use client";

import { useEffect, useRef, type ReactNode } from "react";
import s from "./landing.module.css";

export function LandingMotion({ children, className }: { children: ReactNode; className: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mouse = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sections = Array.from(container.querySelectorAll<HTMLElement>("main > section, footer"));
    const revealSelector = [s.sectionHeading, s.problemHeading, s.problemGrid, s.featureCard, s.priceCard,
      s.importVisual, s.demoFrame, s.stepsGrid, s.securityGrid, s.roadmapGrid, s.faqList, s.finalCta]
      .map((name) => `.${name}`).join(",");
    const reveals = Array.from(container.querySelectorAll<HTMLElement>(revealSelector));
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    let current = window.scrollY;
    let target = current;
    let previousTime = 0;
    let direction = 0;
    let stops: number[] = [];

    const measure = () => {
      stops = sections.map((section) => Math.max(0, section.getBoundingClientRect().top + window.scrollY - 32));
    };
    const cancel = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      current = target = window.scrollY;
      direction = 0;
    };
    const animate = (time: number) => {
      const elapsed = Math.min(time - previousTime, 40);
      previousTime = time;
      target = Math.min(target, Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
      current += (target - current) * (1 - Math.exp(-elapsed / 165));
      if (Math.abs(target - current) < 1) current = target;
      // Native smooth scrolling must not compete with this single animation loop.
      window.scrollTo({ top: current, behavior: "instant" });
      current = window.scrollY;
      if (Math.abs(target - current) >= 1) frame = requestAnimationFrame(animate);
      else frame = 0;
    };
    const wheel = (event: WheelEvent) => {
      if (reducedMotion.matches || !mouse.matches || event.defaultPrevented || !event.cancelable ||
        event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
      if (getComputedStyle(document.body).overflowY === "hidden" || document.querySelector('[role="dialog"]')) {
        cancel();
        return;
      }
      // Leave nested scroll areas (including the calendar) under native control.
      for (const node of event.composedPath()) {
        if (node === container) break;
        if (node instanceof HTMLElement && /auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1) {
          cancel();
          return;
        }
      }
      event.preventDefault();
      const nextDirection = Math.sign(event.deltaY);
      if (!frame || direction !== nextDirection) current = target = window.scrollY;
      direction = nextDirection;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const delta = Math.max(-500, Math.min(500, event.deltaY * unit)) * 0.75;
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const reach = window.innerHeight * 0.85;
      target = Math.max(0, Math.min(max, Math.max(current - reach, Math.min(current + reach, target + delta))));
      // Ease into the next section. Once there, the next wheel input continues normally.
      const stop = direction > 0
        ? stops.find((position) => position > current + 36 && position <= target + 45)
        : stops.findLast((position) => position < current - 36 && position >= target - 45);
      if (stop !== undefined) target = Math.max(0, Math.min(max, stop));
      if (!frame) {
        previousTime = performance.now();
        frame = requestAnimationFrame(animate);
      }
    };
    const keyboard = (event: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Tab", "Escape"].includes(event.key)) cancel();
    };
    const configureReveals = () => {
      cancel();
      observer?.disconnect();
      reveals.forEach((element) => element.removeAttribute("data-reveal"));
      if (reducedMotion.matches || !("IntersectionObserver" in window)) return;
      observer = new IntersectionObserver((entries) => {
        entries.forEach(({ target: element, isIntersecting }) => {
          if (!isIntersecting) return;
          element.setAttribute("data-reveal", "visible");
          observer?.unobserve(element);
        });
      }, { rootMargin: "0px 0px -24px 0px", threshold: 0 });
      reveals.forEach((element) => {
        // Already visible content stays visible, including direct hash navigation.
        if (element.getBoundingClientRect().top < window.innerHeight - 24) return;
        element.setAttribute("data-reveal", "pending");
        observer?.observe(element);
      });
    };
    const focus = (event: FocusEvent) => {
      cancel();
      if (!(event.target instanceof HTMLElement)) return;
      reveals.filter((element) => element.contains(event.target as Node)).forEach((element) => {
        element.setAttribute("data-reveal", "visible");
        observer?.unobserve(element);
      });
    };
    const resize = new ResizeObserver(measure);
    resize.observe(container);
    measure();
    configureReveals();
    container.addEventListener("wheel", wheel, { passive: false });
    container.addEventListener("focusin", focus);
    window.addEventListener("keydown", keyboard);
    window.addEventListener("pointerdown", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("resize", measure);
    reducedMotion.addEventListener("change", configureReveals);
    return () => {
      cancel();
      observer?.disconnect();
      resize.disconnect();
      reveals.forEach((element) => element.removeAttribute("data-reveal"));
      container.removeEventListener("wheel", wheel);
      container.removeEventListener("focusin", focus);
      window.removeEventListener("keydown", keyboard);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("resize", measure);
      reducedMotion.removeEventListener("change", configureReveals);
    };
  }, []);

  return <div ref={root} className={className}>{children}</div>;
}
