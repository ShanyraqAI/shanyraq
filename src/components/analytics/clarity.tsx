"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Clarity from "@microsoft/clarity";

// The Clarity project ID is public; the env var overrides it. Only production traffic is recorded.
const projectId = process.env.NODE_ENV === "production" ? (process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "yrbeb5lrbc") : undefined;
// Recordings stay on public pages: the dashboard contains guest data and lock credentials.
const recordedPaths = ["/", "/login", "/register"];

export function ClarityAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!projectId || !/^[a-z0-9]{6,20}$/i.test(projectId) || !recordedPaths.includes(pathname)) return;
    // The package skips injection when the script tag already exists.
    Clarity.init(projectId);
  }, [pathname]);

  return null;
}
