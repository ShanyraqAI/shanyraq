declare global {
  interface Window { clarity?: (...args: unknown[]) => void }
}

export function clarityEvent(name: string) {
  if (typeof window !== "undefined") window.clarity?.("event", name);
}
