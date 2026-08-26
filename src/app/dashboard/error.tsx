"use client";

import { useEffect } from "react";
import { t } from "@/lib/i18n";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <h2 className="text-lg font-semibold">{t.errors.genericTitle}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{t.errors.genericBody}</p>
      <button
        onClick={reset}
        className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {t.common.tryAgain}
      </button>
    </div>
  );
}
