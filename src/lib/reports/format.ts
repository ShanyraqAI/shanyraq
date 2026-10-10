export function formatReportMoney(amount: number, currency: string, compact = false): string {
  try {
    return new Intl.NumberFormat("ru-KZ", { style: "currency", currency, maximumFractionDigits: 0, ...(compact ? { notation: "compact" as const } : {}) }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString("ru-RU")} ${currency}`;
  }
}
