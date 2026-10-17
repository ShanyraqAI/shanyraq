"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureInstallPrompt } from "@/components/pwa/use-pwa-install";
import { setOutboxScope } from "@/lib/offline/outbox";
import { clearReadSnapshots } from "@/lib/offline/read-snapshots";
import { clearSavedPages } from "@/lib/offline/device-data";

export function PwaRegistration({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();

  useEffect(() => captureInstallPrompt(), []);

  useEffect(() => {
    if (
      (!enabled && window.location.hostname !== "localhost") ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, [enabled]);

  // Saved workspace pages belong to one session; the login screen means it has ended.
  useEffect(() => {
    if (pathname === "/login" || pathname === "/register") {
      void clearReadSnapshots().catch(() => undefined);
      setOutboxScope("");
      void clearSavedPages();
    }
  }, [pathname]);

  return null;
}
