export const SUPPORT_REQUEST_STATUSES = ["OPEN", "REVIEWING", "RESOLVED"] as const;
export type SupportRequestStatus = (typeof SUPPORT_REQUEST_STATUSES)[number];

export const SUPPORT_STATUS_LABELS: Record<SupportRequestStatus, string> = {
  OPEN: "Новое",
  REVIEWING: "В работе",
  RESOLVED: "Решено",
};

export function supportResolutionDate(status: SupportRequestStatus, now: Date): Date | null {
  return status === "RESOLVED" ? now : null;
}
