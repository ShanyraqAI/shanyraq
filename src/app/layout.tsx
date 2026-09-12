import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "Shanyraq AI — управление отелем и каналами продаж",
  description:
    "Shanyraq AI — платформа для отелей: бронирования, календарь, номерной фонд, тарифы и синхронизация с каналами продаж.",
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
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
