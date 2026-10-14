import { redirect } from "next/navigation";
import { hasHotelPermission } from "@/lib/access";
import { getCurrentMembership } from "@/lib/tenant";
import { CommunicationsWorkspace } from "@/components/communications/workspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Коммуникации" };
export default async function CommunicationsPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (!hasHotelPermission(membership, "RESERVATIONS")) return <p>Нет доступа к сообщениям гостей. Обратитесь к владельцу объекта.</p>;
  return <CommunicationsWorkspace />;
}
