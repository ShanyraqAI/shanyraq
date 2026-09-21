"use client";

import { useSyncExternalStore } from "react";

const query = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isDesktop() {
  return window.matchMedia(query).matches;
}

export function DesktopOnly({ children }: { children: React.ReactNode }) {
  const visible = useSyncExternalStore(subscribe, isDesktop, () => false);
  if (!visible) return <div aria-hidden="true" className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-xl bg-secondary/60" />)}</div>;
  return children;
}
