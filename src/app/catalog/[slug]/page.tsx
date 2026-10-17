import { PublicCatalog } from "@/components/guest-stay/catalog";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PublicCatalog slug={slug} />;
}
