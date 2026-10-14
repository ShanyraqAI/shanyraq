"use client";
import { useEffect, useState } from "react";
import type { BookingOptions } from "@/lib/reservations/booking-options-types";

/** Results are keyed by request AND authenticated scope, never reused across tenants.
 * Abort stale requests; retain caller's form state on failures. No private browser cache. */
export function useBookingOptions(
  query: string | null,
  scope: string,
  kk: boolean,
) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: BookingOptions;
    error?: string;
  } | null>(null);
  const key = `${scope}:${query}:${revision}`;
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const failure = kk
      ? "Деректерді тексеру мүмкін болмады. Қайталап көріңіз."
      : "Не удалось проверить данные. Повторите попытку.";
    void fetch(`/api/reservations/booking-options?${query}`, {
      cache: "no-store",
      headers: { "x-shanyraq-scope": scope },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(failure);
        const data: BookingOptions = await response.json();
        if (data.scope !== scope) throw new Error(failure);
        if (!controller.signal.aborted) setResult({ key, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, error: failure });
      });
    return () => controller.abort();
  }, [key, query, scope, kk]);
  const current = result?.key === key ? result : null;
  return {
    data: current?.data,
    error: current?.error,
    loading: Boolean(query && !current),
    retry: () => setRevision((value) => value + 1),
  };
}
