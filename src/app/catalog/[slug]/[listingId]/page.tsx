import { PublicCatalog } from "@/components/guest-stay/catalog";
import { selectionFromQuery } from "@/lib/guest-stay/presentation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; listingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [p, q] = await Promise.all([params, searchParams]);
  return (
    <PublicCatalog
      {...p}
      preview={q.preview === "true"}
      initialSelection={selectionFromQuery(q)}
    />
  );
}
