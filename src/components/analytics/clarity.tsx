"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

// The Clarity project ID is public; the env var overrides it. Only production traffic is recorded.
const projectId = process.env.NODE_ENV === "production" ? (process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "yrbeb5lrbc") : undefined;
// Recordings stay on public pages: the dashboard contains guest data and lock credentials.
const recordedPaths = ["/", "/login", "/register"];

export function Clarity() {
  const pathname = usePathname();
  if (!projectId || !/^[a-z0-9]{6,20}$/i.test(projectId) || !recordedPaths.includes(pathname)) return null;
  return <Script id="clarity" strategy="afterInteractive">{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${projectId}");`}</Script>;
}
