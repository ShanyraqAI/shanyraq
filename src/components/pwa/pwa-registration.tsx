"use client";

import { useEffect } from "react";

export function PwaRegistration({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if ((!enabled && window.location.hostname !== "localhost") || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, [enabled]);

  return null;
}

