import type { Metadata } from "next";
import { GuestStayPage } from "@/components/guest-stay/guest";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ваше проживание",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: {
    title: "Ваше проживание",
    description: "Персональная страница гостя",
  },
};
export default function Page() {
  return <GuestStayPage />;
}
