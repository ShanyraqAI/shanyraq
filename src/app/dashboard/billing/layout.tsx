import { redirect } from "next/navigation";
import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  if (!PRODUCT_AVAILABILITY.billing) redirect("/dashboard");
  return children;
}

