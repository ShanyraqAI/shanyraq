import { PublicCatalog } from "@/components/guest-stay/catalog";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; listingId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const p = await params;
  const q = await searchParams;
  return <PublicCatalog {...p} preview={q.preview === "true"} />;
}
