declare global {
  interface Window { clarity?: unknown }
}

/** Analytics must never break the UI, so failures here are ignored. */
export function clarityEvent(name: string) {
  try {
    if (typeof window !== "undefined" && typeof window.clarity === "function") window.clarity("event", name);
  } catch { /* Blocked or not-yet-loaded Clarity script. */ }
}
