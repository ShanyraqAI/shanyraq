"use client";

import type { ReactNode } from "react";
import { clearDeviceData } from "@/lib/offline/device-data";
import { scopedOutbox } from "@/lib/offline/outbox";

/** Sign-out that also wipes saved offline pages and warns about unsent changes. */
export function SignOutForm({ action, locale, children }: { action: () => Promise<void>; locale: "ru" | "kk"; children: ReactNode }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const unsent = scopedOutbox().length;
        const message = locale === "kk"
          ? `${unsent} өзгеріс әлі жіберілмеген. Шықсаңыз, олар жойылады. Жалғастыру керек пе?`
          : `Есть неотправленные изменения: ${unsent}. После выхода они будут удалены. Продолжить?`;
        if (unsent && !window.confirm(message)) {
          event.preventDefault();
          return;
        }
        void clearDeviceData();
      }}
    >
      {children}
    </form>
  );
}
