import { redirect } from "next/navigation";
import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";

export default function ChannelsLayout({ children }: { children: React.ReactNode }) {
  if (!PRODUCT_AVAILABILITY.channels) redirect("/dashboard");
  return children;
}

