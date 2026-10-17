import { createHash } from "node:crypto";
import type { Prisma, PrismaClient, GuestPaymentRequest } from "@prisma/client";
import type { z } from "zod";
import type { CurrentMembership } from "@/lib/tenant";
import { hasHotelPermission } from "@/lib/access";
import { AuthorizationError, PublicError } from "@/server/errors";
import { executeOperation } from "@/lib/reservations/operation";
import {
  kaspiUrl,
  paymentBalance,
  requestMessage,
  validatePaymentAmount,
} from "./policy";
import type { paymentCommand } from "./schema";
import type {
  PaymentMethodView,
  PaymentSettings,
  PaymentWorkspace,
  PreparedPayment,
} from "./types";
const digest = (input: unknown) =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");
export const paymentScope = (m: CurrentMembership) =>
  `${m.userId}:${m.organizationId}:${m.hotelId}`;
const tenant = (m: CurrentMembership) => ({
  hotelId: m.hotelId,
  organizationId: m.organizationId,
});
async function authorize(
  tx: Prisma.TransactionClient,
  m: CurrentMembership,
  owner = false,
) {
  const live = await tx.membership.findFirst({
    where: {
      id: m.id,
      userId: m.userId,
      hotelId: m.hotelId,
      hotel: { orgId: m.organizationId },
    },
  });
  if (
    !live ||
    (owner ? live.role !== "OWNER" : !hasHotelPermission(live, "RESERVATIONS"))
  )
    throw new AuthorizationError();
}
const viewMethod = (m: PaymentMethodView): PaymentMethodView => ({
  id: m.id,
  rentalPropertyId: m.rentalPropertyId,
  name: m.name,
  recipient: m.recipient,
  url: m.url,
  enabled: m.enabled,
  version: m.version,
});
function prepared(r: GuestPaymentRequest): PreparedPayment {
  return {
    id: r.id,
    text: r.text,
    amount: r.amount.toFixed(2),
    recipient: r.recipient,
    url: r.url,
    createdAt: r.createdAt.toISOString(),
  };
}
export async function getPaymentSettings(
  client: PrismaClient,
  m: CurrentMembership,
): Promise<PaymentSettings> {
  return client.$transaction(async (tx) => {
    await authorize(tx, m, true);
    const [properties, methods] = await Promise.all([
      tx.rentalProperty.findMany({
        where: tenant(m),
        orderBy: { internalName: "asc" },
        select: { id: true, internalName: true },
      }),
      tx.kaspiPaymentMethod.findMany({ where: tenant(m) }),
    ]);
    return {
      scope: paymentScope(m),
      properties: properties.map((p) => ({ id: p.id, name: p.internalName })),
      methods: methods.map(viewMethod),
    };
  });
}
async function workspace(
  tx: Prisma.TransactionClient,
  m: CurrentMembership,
  id: string,
): Promise<PaymentWorkspace> {
  const r = await tx.reservation.findFirst({
    where: { id, hotelId: m.hotelId, hotel: { orgId: m.organizationId } },
    select: {
      id: true,
      rentalPropertyId: true,
      sequenceNumber: true,
      currency: true,
      totalAmount: true,
      depositAmount: true,
      paymentCollect: true,
      status: true,
      updatedAt: true,
      checkIn: true,
      checkOut: true,
      roomId: true,
      guestId: true,
    },
  });
  if (!r) throw new PublicError("Бронь не найдена в текущем объекте.");
  const [method, operations] = await Promise.all([
    tx.kaspiPaymentMethod.findFirst({
      where: { ...tenant(m), rentalPropertyId: r.rentalPropertyId },
    }),
    tx.financialOperation.findMany({
      where: {
        ...tenant(m),
        reservationId: id,
        rentalPropertyId: r.rentalPropertyId,
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        type: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);
  const balance = paymentBalance(
    r.totalAmount.toFixed(2),
    operations.map((o) => ({ ...o, amount: o.amount.toFixed(2) })),
    r.currency,
  );
  // Includes ledger row identities and timestamps, not just totals; invalidates old prepared messages.
  const revision = digest([
    r,
    method,
    operations.sort((a, b) => a.id.localeCompare(b.id)),
  ]);
  const history = await tx.guestPaymentRequest.findMany({
    where: { ...tenant(m), reservationId: id },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, amount: true, createdAt: true, revision: true },
  });
  return {
    scope: paymentScope(m),
    reservationId: id,
    revision,
    booking: r.sequenceNumber
      ? `B${String(r.sequenceNumber).padStart(3, "0")}`
      : r.id,
    currency: r.currency,
    total: r.totalAmount.toFixed(2),
    deposit: r.depositAmount.toFixed(2),
    ...balance,
    paymentCollect: r.paymentCollect,
    status: r.status,
    method: method ? viewMethod(method) : null,
    history: history.map((h) => ({
      id: h.id,
      amount: h.amount.toFixed(2),
      createdAt: h.createdAt.toISOString(),
      stale: h.revision !== revision,
    })),
  };
}
export async function getPaymentWorkspace(
  client: PrismaClient,
  m: CurrentMembership,
  id: string,
) {
  return client.$transaction(
    async (tx) => {
      await authorize(tx, m);
      return workspace(tx, m, id);
    },
    { isolationLevel: "RepeatableRead" },
  );
}
async function audit(
  tx: Prisma.TransactionClient,
  m: CurrentMembership,
  action: string,
  entity: string,
  id: string,
  meta: unknown,
) {
  await tx.auditLog.create({
    data: {
      hotelId: m.hotelId,
      actor: m.userId,
      actorUserId: m.userId,
      action,
      entity,
      entityId: id,
      metaJson: JSON.stringify(meta),
    },
  });
}
export async function runPaymentCommand(
  client: PrismaClient,
  m: CurrentMembership,
  c: z.infer<typeof paymentCommand>,
) {
  if (c.action === "saveMethod") {
    let url: string;
    try {
      url = kaspiUrl(c.url);
    } catch (e) {
      throw new PublicError(
        e instanceof Error ? e.message : "Проверьте ссылку",
      );
    }
    return client.$transaction(async (tx) => {
      await authorize(tx, m, true);
      const lock = `kaspi-config:${m.hotelId}:${c.rentalPropertyId}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock},0))::text`;
      const property = await tx.rentalProperty.findFirst({
        where: { id: c.rentalPropertyId, ...tenant(m) },
      });
      if (!property) throw new PublicError("Объект не найден.");
      const previous = await tx.kaspiPaymentMethod.findFirst({
        where: { ...tenant(m), rentalPropertyId: property.id },
      });
      if ((previous?.version ?? 0) !== c.version)
        throw new PublicError(
          "Настройки изменились в другой вкладке. Перезагрузите их перед сохранением.",
        );
      const data = {
        name: c.name,
        recipient: c.recipient,
        url,
        enabled: c.enabled,
      };
      const method = previous
        ? await tx.kaspiPaymentMethod.update({
            where: { id: previous.id },
            data: { ...data, version: { increment: 1 } },
          })
        : await tx.kaspiPaymentMethod.create({
            data: { ...tenant(m), rentalPropertyId: property.id, ...data },
          });
      await audit(
        tx,
        m,
        "guest_payment.method_saved",
        "KaspiPaymentMethod",
        method.id,
        {
          rentalPropertyId: property.id,
          version: method.version,
          enabled: method.enabled,
          bankVerified: false,
        },
      );
      return viewMethod(method);
    });
  }
  if (c.action === "validate") {
    return client.$transaction(
      async (tx) => {
        await authorize(tx, m);
        const row = await tx.guestPaymentRequest.findFirst({
          where: { id: c.id, ...tenant(m) },
        });
        if (!row) throw new PublicError("Запрос не найден.");
        const w = await workspace(tx, m, row.reservationId);
        if (w.revision !== row.revision || !w.method?.enabled)
          throw new PublicError(
            "Бронь, оплаты или реквизиты изменились. Подготовьте и проверьте новый запрос.",
          );
        return prepared(row);
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  // Access is checked before receipt replay too: a former employee must not retrieve old private text.
  await client.$transaction((tx) => authorize(tx, m));
  const result = await executeOperation<PreparedPayment>(
    client,
    { userId: m.userId, hotelId: m.hotelId },
    { key: c.key, scope: `${m.userId}:${m.hotelId}` },
    "guest_payment.prepare",
    c,
    async (tx) => {
      await authorize(tx, m);
      await tx.$queryRaw`SELECT id FROM "Reservation" WHERE id=${c.reservationId} AND "hotelId"=${m.hotelId} FOR UPDATE`;
      const w = await workspace(tx, m, c.reservationId);
      if (w.revision !== c.revision)
        throw new PublicError(
          "Данные изменились. Обновите сумму и проверьте запрос заново.",
        );
      if (!w.method?.enabled)
        throw new PublicError(
          "Для этого объекта нет включённой ссылки Kaspi Pay.",
        );
      let amount: string;
      try {
        amount = validatePaymentAmount({
          ...c,
          remaining: w.remaining,
          status: w.status,
          currency: w.currency,
          paymentCollect: w.paymentCollect,
        });
      } catch (e) {
        throw new PublicError(
          e instanceof Error ? e.message : "Проверьте сумму",
        );
      }
      const text = requestMessage({
        booking: w.booking,
        amount,
        recipient: w.method.recipient,
        url: w.method.url,
        locale: c.locale,
        purpose: c.purpose,
      });
      const requestDigest = digest([
        m.userId,
        w.revision,
        amount,
        c.locale,
        c.purpose,
      ]);
      const old = await tx.guestPaymentRequest.findUnique({
        where: {
          hotelId_userId_digest: {
            hotelId: m.hotelId,
            userId: m.userId,
            digest: requestDigest,
          },
        },
      });
      if (old) return { ok: true, data: prepared(old) };
      const row = await tx.guestPaymentRequest.create({
        data: {
          ...tenant(m),
          rentalPropertyId: w.method.rentalPropertyId,
          reservationId: c.reservationId,
          userId: m.userId,
          digest: requestDigest,
          revision: w.revision,
          amount,
          currency: "KZT",
          recipient: w.method.recipient,
          url: w.method.url,
          text,
        },
      });
      await audit(
        tx,
        m,
        "guest_payment.request_prepared",
        "GuestPaymentRequest",
        row.id,
        {
          reservationId: c.reservationId,
          amount,
          currency: "KZT",
          state: "PREPARED",
          notPayment: true,
        },
      );
      return { ok: true, data: prepared(row) };
    },
  );
  if (!result.ok || !result.data)
    throw new PublicError(result.error ?? "Не удалось подготовить запрос.");
  return result.data;
}
