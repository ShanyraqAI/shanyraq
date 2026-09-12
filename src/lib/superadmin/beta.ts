export const BETA_HOTEL_STATUSES = [
  "NOT_ENROLLED",
  "INVITED",
  "ONBOARDING",
  "ACTIVE",
  "PAUSED",
  "LEFT",
] as const;

export type BetaHotelStatus = (typeof BETA_HOTEL_STATUSES)[number];

export const BETA_HOTEL_STATUS_LABELS: Record<BetaHotelStatus, string> = {
  NOT_ENROLLED: "Не участвует",
  INVITED: "Приглашён",
  ONBOARDING: "Подключение",
  ACTIVE: "Активная бета",
  PAUSED: "На паузе",
  LEFT: "Вышел из беты",
};

export function betaStatusNeedsReason(status: BetaHotelStatus): boolean {
  return status === "PAUSED" || status === "LEFT";
}

export function nextBetaStartedAt(status: BetaHotelStatus, current: Date | null, now = new Date()): Date | null {
  return status === "ACTIVE" && !current ? now : current;
}
