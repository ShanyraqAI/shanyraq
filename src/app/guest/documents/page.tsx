import type { Metadata } from "next";
import { GuestDocumentSigning } from "@/components/documents/guest-document-signing";
export const metadata: Metadata = { title: "Ознакомление и подписание · Shanyraq", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";
export default function GuestSigningPage() { return <GuestDocumentSigning />; }
