import { BillingError } from "@/lib/billing/policy";
export class PublicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicError";
  }
}

export class RateLimitError extends PublicError {
  constructor() {
    super("Слишком много попыток. Подождите несколько минут и попробуйте снова.");
    this.name = "RateLimitError";
  }
}

/** Maps service errors to safe, user-facing messages. Never leaks internals. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof BillingError) return error.message;
  if (error instanceof PublicError) return error.message;
  // PostgreSQL exclusion violations are expected inventory conflicts.
  if (error instanceof Error &&
      ["PrismaClientKnownRequestError", "PrismaClientUnknownRequestError"].includes(error.name) &&
      error.message.includes("Reservation_no_room_overlap")) {
    return "В этом номере уже есть бронь на выбранные даты.";
  }
  const incidentId = crypto.randomUUID();
  console.error(`[${incidentId}] Action failed`, { type: error instanceof Error ? error.name : "unknown" });
  return "Не удалось выполнить действие. Попробуйте ещё раз.";
}
