import { PublicError } from "@/server/errors";
/** Reject ambiguous clocks instead of inventing an ordering from UUIDs or receive time. */
export function revisionDecision(
  insertedAt: string | null,
  previous: Date | null,
): { apply: boolean; providerTime: Date } {
  if (
    !insertedAt ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(insertedAt)
  )
    throw new PublicError(
      "Revision не содержит однозначное время провайдера; требуется проверка порядка событий.",
    );
  const providerTime = new Date(insertedAt);
  if (!Number.isFinite(providerTime.getTime()))
    throw new PublicError("Некорректное время revision Channex.");
  if (previous && providerTime.getTime() === previous.getTime())
    throw new PublicError(
      "Две revisions имеют одинаковое время; автоматическое применение остановлено для проверки.",
    );
  return { apply: !previous || providerTime > previous, providerTime };
}
