import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegistration } from "@/components/pwa/pwa-registration";
import { getSiteUrl } from "@/lib/site-url";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Shanyraq Mobile",
    template: "%s · Shanyraq",
  },
  description:
    "Shanyraq — управление краткосрочной арендой, бронями и каналами продаж в Казахстане.",
  applicationName: "Shanyraq Mobile",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Shanyraq",
  },
  formatDetection: { telephone: false },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    yandex: process.env.YANDEX_VERIFICATION || undefined,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#193e30",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="antialiased">
      <body
        suppressHydrationWarning
        style={{
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {children}
        <PwaRegistration enabled={process.env.NODE_ENV === "production"} />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
