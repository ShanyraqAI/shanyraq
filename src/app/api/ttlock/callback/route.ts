import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function equalsSecret(provided: string, expected: string) {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const expected = process.env.TTLOCK_CALLBACK_TOKEN;
  const provided = request.nextUrl.searchParams.get("token") ?? "";
  if (!expected) return NextResponse.json({ error: "Callback is not configured" }, { status: 503 });
  if (!equalsSecret(provided, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.text();
  if (body.length > 24_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const fields: Record<string, string> = {};
  new URLSearchParams(body).forEach((value, key) => { fields[key] = value; });
  const remoteLockId = fields.lockId;
  if (!remoteLockId || !/^\d+$/.test(remoteLockId)) return NextResponse.json({ error: "Missing lockId" }, { status: 400 });

  const locks = await db.tTLockLock.findMany({ where: { lockId: remoteLockId }, select: { id: true, hotelId: true } });
  if (!locks.length) return NextResponse.json({ accepted: true });

  const stableFields = [remoteLockId, fields.recordId ?? "", fields.recordType ?? fields.eventType ?? "", fields.lockDate ?? fields.date ?? "", fields.username ?? "", fields.success ?? "", fields.state ?? ""];
  const eventKey = fields.recordId || createHash("sha256").update(stableFields.join("|")).digest("hex");
  const recordType = Number(fields.recordType);
  const lockDate = Number(fields.lockDate ?? fields.date);
  const success = fields.success === "1" ? true : fields.success === "0" ? false : null;
  const eventAt = Number.isFinite(lockDate) && lockDate > 0 ? new Date(lockDate) : null;
  const recordNames: Record<number, string> = { 1: "Открытие из приложения", 3: "Открытие через шлюз", 4: "Открытие кодом", 7: "Открытие картой", 8: "Открытие отпечатком", 11: "Открытие по Bluetooth", 12: "Открытие через шлюз", 29: "Необычное открытие", 30: "Дверь закрыта", 31: "Дверь открыта", 32: "Открытие изнутри", 34: "Закрытие кодом", 37: "Удалённая команда", 44: "Тревога взлома", 45: "Автоблокировка", 48: "Несколько неверных кодов" };
  const summary = Number.isInteger(recordType) ? recordNames[recordType] ?? `Событие замка ${recordType}` : (fields.eventType ?? "Событие замка TTLock");
  const safeFields = Object.fromEntries(Object.entries(fields).filter(([key]) => !/(pwd|password|secret|token|key)/i.test(key)));

  await db.tTLockEvent.createMany({
    data: locks.map((lock) => ({
      hotelId: lock.hotelId,
      lockRefId: lock.id,
      eventKey,
      lockId: remoteLockId,
      recordType: Number.isInteger(recordType) ? recordType : null,
      success,
      actor: fields.username?.slice(0, 120) ?? null,
      eventAt,
      summary,
      payload: safeFields,
    })),
    skipDuplicates: true,
  });
  return NextResponse.json({ accepted: true });
}
