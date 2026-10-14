import { db } from "@/lib/db";
import type { CurrentMembership } from "@/lib/tenant";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { PublicError } from "@/server/errors";
import { renderDocumentPdf } from "@/lib/documents/pdf";
import { requireReservation, scopeOf } from "@/lib/communications/service";
import { CONSENT_TEXT, CONSENT_VERSION, digest, newSigningToken, signingLink, MAX_SIGNING_PDF_BYTES, tokenSchema, guestSigningCommandSchema } from "./security";
import type { GuestDocumentVM, SigningWorkspace } from "./types";
const tenant = (m: CurrentMembership) => ({ organizationId: m.organizationId, hotelId: m.hotelId });
const names: Record<string, string> = { CONTRACT: "Договор", INVOICE: "Счёт-фактура", ACT: "Акт" };
const title = (d: { type: string; documentNumber: string }) => `${names[d.type] ?? "Документ"} №${d.documentNumber}`;
const invalidLink = () => new PublicError("Ссылка недоступна или устарела. Попросите владельца прислать новую.");
function reservationAvailable(r: { status: string; updatedAt: Date }, version: Date) { return !["CANCELLED", "NO_SHOW"].includes(r.status) && r.updatedAt.getTime() === version.getTime(); }

export async function getSigningWorkspace(m: CurrentMembership, reservationId: string): Promise<SigningWorkspace> {
  const reservation = await requireReservation(m, reservationId);
  const t = tenant(m);
  const [documents, requests] = await Promise.all([
    db.generatedDocument.findMany({ where: { ...t, reservationId }, select: { id: true, type: true, documentNumber: true }, orderBy: { createdAt: "desc" } }),
    db.documentSigningRequest.findMany({ where: { ...t, reservationId }, select: { id: true, title: true, documentId: true, expiresAt: true, signedAt: true, signerName: true, revokedAt: true, reservationVersion: true, pdfHash: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return { documents: documents.map((d) => ({ id: d.id, title: title(d) })), requests: requests.map((r) => ({ id: r.id, title: r.title, documentId: r.documentId, pdfHash: r.pdfHash, createdAt: r.createdAt.toISOString(), expiresAt: r.expiresAt.toISOString(), signedAt: r.signedAt?.toISOString() ?? null, signerName: r.signerName, state: r.revokedAt ? "REVOKED" : r.signedAt ? "SIGNED" : !reservationAvailable(reservation, r.reservationVersion) ? "OUTDATED" : r.expiresAt <= new Date() ? "EXPIRED" : "PENDING" })), scope: scopeOf(m) };
}
export async function createSigningRequest(m: CurrentMembership, documentId: string, expiresInDays: number) {
  const origin = process.env.APP_URL;
  if (!origin) throw new PublicError("Настройте APP_URL Shanyraq для создания защищённой ссылки");
  const token = newSigningToken();
  let url: string;
  try { url = signingLink(origin, token); } catch { throw new PublicError("APP_URL должен содержать HTTPS-адрес Shanyraq"); }
  if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 14) throw new PublicError("Срок ссылки: от 1 до 14 дней");
  const document = await db.generatedDocument.findFirst({ where: { id: documentId, ...tenant(m) }, select: { id: true, type: true, documentNumber: true, reservationId: true, snapshot: true } });
  if (!document) throw new PublicError("Документ не найден в текущем объекте");
  const reservation = await requireReservation(m, document.reservationId);
  if (["CANCELLED", "NO_SHOW"].includes(reservation.status)) throw new PublicError("Бронь отменена или отмечена как неявка");
  const pdf = await renderDocumentPdf(document.snapshot);
  if (pdf.byteLength > MAX_SIGNING_PDF_BYTES) throw new PublicError("Документ слишком большой для онлайн-подписания");
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000);
  const saved = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`document-signing:${document.id}`}, 0))::text`;
    // A new link replaces pending ones. Signed evidence is never overwritten.
    await tx.documentSigningRequest.updateMany({ where: { ...tenant(m), documentId, signedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const r = await tx.documentSigningRequest.create({ data: { ...tenant(m), documentId, reservationId: document.reservationId, createdById: m.userId, title: title(document), tokenHash: digest(token), pdfBytes: new Uint8Array(pdf), pdfHash: digest(pdf), reservationVersion: reservation.updatedAt, expiresAt }, select: { id: true, title: true } });
    await tx.auditLog.create({ data: { hotelId: m.hotelId, actorUserId: m.userId, actor: m.userId, action: "document.signing_requested", entity: "DocumentSigningRequest", entityId: r.id } });
    return r;
  });
  return { ...saved, url, expiresAt: expiresAt.toISOString() };
}
export async function revokeSigningRequest(m: CurrentMembership, requestId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "DocumentSigningRequest" WHERE "id" = ${requestId} AND "hotelId" = ${m.hotelId} AND "organizationId" = ${m.organizationId} FOR UPDATE`;
    const changed = await tx.documentSigningRequest.updateMany({ where: { id: requestId, ...tenant(m), revokedAt: null }, data: { revokedAt: new Date() } });
    if (!changed.count) throw new PublicError("Запрос не найден или ссылка уже отозвана");
    await tx.auditLog.create({ data: { hotelId: m.hotelId, actorUserId: m.userId, actor: m.userId, action: "document.signing_link_revoked", entity: "DocumentSigningRequest", entityId: requestId } });
    return { ok: true };
  });
}
async function availableRequest(token: string, tx: Prisma.TransactionClient = db) {
  if (!tokenSchema.safeParse(token).success) throw invalidLink();
  const r = await tx.documentSigningRequest.findUnique({ where: { tokenHash: digest(token) }, include: { reservation: { select: { status: true, updatedAt: true } } } });
  if (!r || r.revokedAt || r.expiresAt <= new Date() || (!r.signedAt && !reservationAvailable(r.reservation, r.reservationVersion))) throw invalidLink();
  return r;
}
function guestView(r: { title: string; pdfHash: string; expiresAt: Date; signedAt: Date | null; signerName: string | null }): GuestDocumentVM {
  return { title: r.title, pdfHash: r.pdfHash, expiresAt: r.expiresAt.toISOString(), signedAt: r.signedAt?.toISOString() ?? null, signerName: r.signerName, consentVersion: CONSENT_VERSION, consentText: CONSENT_TEXT };
}
export async function guestSigningCommand(command: z.infer<typeof guestSigningCommandSchema>) {
  command = guestSigningCommandSchema.parse(command);
  if (command.action === "load") return { kind: "json" as const, data: guestView(await availableRequest(command.token)) };
  if (command.action === "pdf") { const r = await availableRequest(command.token); return { kind: "pdf" as const, bytes: r.pdfBytes }; }
  if (command.action === "receipt") {
    const r = await availableRequest(command.token);
    if (!r.signedAt || !r.evidence) throw new PublicError("Документ ещё не подписан");
    return { kind: "receipt" as const, data: r.evidence };
  }
  // GET/load/pdf never sign. Explicit consent plus an intentional POST is required.
  const data = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "DocumentSigningRequest" WHERE "tokenHash" = ${digest(command.token)} FOR UPDATE`;
    const candidate = await tx.documentSigningRequest.findUnique({ where: { tokenHash: digest(command.token) }, select: { reservationId: true } });
    if (!candidate) throw invalidLink();
    // Serialize signing with cancellation/booking edits, not just with another signer.
    await tx.$queryRaw`SELECT "id" FROM "Reservation" WHERE "id" = ${candidate.reservationId} FOR UPDATE`;
    const r = await availableRequest(command.token, tx);
    if (r.pdfHash !== command.pdfHash) throw new PublicError("Документ изменился. Откройте ссылку заново.");
    if (r.signedAt) {
      if (r.signerName !== command.signerName) throw new PublicError("Документ уже подписан. Повторное подписание недоступно.");
      return guestView(r); // safe retry after an interrupted response
    }
    const signedAt = new Date();
    const evidence = { requestId: r.id, documentId: r.documentId, title: r.title, originalPdfSha256: r.pdfHash, signerName: command.signerName, signedAt: signedAt.toISOString(), consentVersion: CONSENT_VERSION, consentText: CONSENT_TEXT, method: "LINK_TYPED_NAME", identityVerified: false };
    const evidenceWithHash = { ...evidence, evidenceSha256: digest(JSON.stringify(evidence)) };
    await tx.documentSigningRequest.update({ where: { id: r.id }, data: { signedAt, signerName: command.signerName, consentVersion: CONSENT_VERSION, evidence: evidenceWithHash } });
    await tx.auditLog.create({ data: { hotelId: r.hotelId, actor: "guest-link", action: "document.signed_by_link", entity: "DocumentSigningRequest", entityId: r.id } });
    return guestView({ ...r, signedAt, signerName: command.signerName });
  });
  return { kind: "json" as const, data };
}
export async function staffSigningReceipt(m: CurrentMembership, id: string) {
  const r = await db.documentSigningRequest.findFirst({ where: { id, ...tenant(m), signedAt: { not: null } }, select: { evidence: true } });
  if (!r?.evidence) throw new PublicError("Подтверждение не найдено");
  return r.evidence;
}
