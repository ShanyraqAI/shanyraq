import { OverbookingError } from "@/lib/reservations/service";

/** Maps service errors to safe, user-facing messages. Never leaks internals. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof OverbookingError) return error.message;
  if (error instanceof Error) {
    return error.message.length <= 300 ? error.message : "Не удалось выполнить действие. Попробуйте ещё раз.";
  }
  return "Не удалось выполнить действие. Попробуйте ещё раз.";
}
