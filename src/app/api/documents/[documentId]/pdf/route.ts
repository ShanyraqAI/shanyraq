import { db } from "@/lib/db";
import { hasHotelPermission } from "@/lib/access";
import { getSessionUser } from "@/lib/auth/session";
import { renderDocumentPdf } from "@/lib/documents/pdf";
import { officialDocumentNumber } from "@/lib/documents/numbers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Требуется вход в аккаунт", { status: 401 });

  // Authorize against the hotel that owns the document, not the hotel that
  // happens to be active in another browser request. A user may belong to
  // several hotels and can switch the active one between creating/downloading.
  const membership = await db.membership.findFirst({
    where: {
      userId: user.id,
      hotel: { generatedDocuments: { some: { id: documentId } } },
    },
    select: { hotelId: true, organizationId: true, role: true, accessLevel: true, permissions: true },
  });
  if (!membership) return new Response("Документ не найден", { status: 404 });
  if (!hasHotelPermission(membership, "RESERVATIONS")) return new Response("Недостаточно прав", { status: 403 });

  const document = await db.generatedDocument.findFirst({
    where: { id: documentId, organizationId: membership.organizationId, hotelId: membership.hotelId },
    select: { type: true, documentNumber: true, snapshot: true },
  });
  if (!document) return new Response("Документ не найден", { status: 404 });

  try {
    const pdf = await renderDocumentPdf(document.snapshot);
    const names: Record<string, string> = { CONTRACT: "dogovor", INVOICE: "schet-faktura", ACT: "akt" };
    const fileName = `${names[document.type] ?? "document"}-${officialDocumentNumber(document.documentNumber)}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[documents.pdf] render failed", {
      documentId,
      type: document.type,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("Не удалось сформировать PDF. Попробуйте ещё раз.", { status: 500 });
  }
}
