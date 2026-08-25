import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "Shanyraq AI — Hotel PMS & Channel Manager",
  description:
    "Shanyraq AI is a hotel management platform: reservations, calendar, inventory, rates and channel synchronization.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body
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
