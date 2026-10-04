"use client";

import type { ReactNode } from "react";
import { useBetaInvite } from "./beta-invite";

export function BetaTrigger({ className, children }: { className?: string; children: ReactNode }) {
  const openBeta = useBetaInvite();
  return <button type="button" className={className} onClick={openBeta}>{children}</button>;
}
