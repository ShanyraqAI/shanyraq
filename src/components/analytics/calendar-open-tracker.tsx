"use client";

import { useEffect } from "react";

export function CalendarOpenTracker({ rangeDays }: { rangeDays: number }) {
  useEffect(() => {
    void fetch("/api/analytics/calendar-opened", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rangeDays }),
      keepalive: true,
    }).catch(() => undefined);
  }, [rangeDays]);

  return null;
}
