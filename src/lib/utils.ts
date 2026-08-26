import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const tengeFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "KZT",
  maximumFractionDigits: 0,
});

/** ₸485 000 style formatting. */
export function formatMoney(amount: number, opts?: { compact?: boolean }): string {
  if (opts?.compact && amount >= 1_000_000) {
    return `₸${(amount / 1_000_000).toFixed(1).replace(".", ",")} млн`;
  }
  if (opts?.compact && amount >= 10_000) {
    return `₸${Math.round(amount / 1000)} тыс.`;
  }
  return tengeFormatter.format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** «2 мин назад» — относительное время для меток синхронизации. */
export function formatTimeAgo(date: Date | null | undefined): string {
  if (!date) return "Никогда";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return seconds <= 5 ? "Только что" : `${seconds} с назад`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}
