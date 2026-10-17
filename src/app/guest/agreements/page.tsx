import type { Metadata } from "next";
import { GuestAgreement } from "@/components/agreements/guest";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Документы по брони",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function GuestAgreementsPage() {
  return <GuestAgreement />;
}
