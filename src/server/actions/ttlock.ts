"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/security/credentials";
import { requireSessionHotelId } from "@/server/guards";

type Credentials = { clientId: string; clientSecret: string; username: string; password: string };
type Token = { access_token: string; refresh_token?: string };
const base = "https://euapi.ttlock.com";

function zonedTime(date: Date, time: string, timezone: string): number {
  const [year, month, day] = date.toISOString().slice(0, 10).split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(target));
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return target - (represented - target);
}

async function ttlock<T>(path: string, values: Record<string, string | number>): Promise<T> {
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(Object.entries(values).map(([k, v]) => [k, String(v)])), cache: "no-store" });
  const data = await response.json() as T & { errcode?: number; errmsg?: string };
  if (!response.ok || (data.errcode && data.errcode !== 0)) throw new Error(data.errmsg || "TTLock не выполнил запрос");
  return data;
}

async function credentials(hotelId: string): Promise<{ stored: Credentials; token: Token }> {
  const row = await db.tTLockConnection.findUnique({ where: { hotelId } });
  if (!row) throw new Error("Сначала подключите аккаунт TTLock");
  const stored = decryptSecret<Credentials>(row.credentials);
  const token = await ttlock<Token>("/oauth2/token", { client_id: stored.clientId, client_secret: stored.clientSecret, username: stored.username, password: createHash("md5").update(stored.password).digest("hex"), grant_type: "password" });
  return { stored, token };
}

export async function saveTTLockConnectionAction(formData: FormData) {
  const hotelId = await requireSessionHotelId({ permission: "ROOMS" });
  const values = { clientId: String(formData.get("clientId") ?? "").trim(), clientSecret: String(formData.get("clientSecret") ?? "").trim(), username: String(formData.get("username") ?? "").trim(), password: String(formData.get("password") ?? "") };
  if (Object.values(values).some((value) => !value)) throw new Error("Заполните все поля TTLock");
  const token = await ttlock<Token>("/oauth2/token", { client_id: values.clientId, client_secret: values.clientSecret, username: values.username, password: createHash("md5").update(values.password).digest("hex"), grant_type: "password" });
  await db.tTLockConnection.upsert({ where: { hotelId }, create: { hotelId, credentials: encryptSecret(values) }, update: { credentials: encryptSecret(values) } });
  void token;
  revalidatePath("/dashboard/locks");
}

export async function syncTTLockLocksAction() {
  const hotelId = await requireSessionHotelId({ permission: "ROOMS" });
  const { stored, token } = await credentials(hotelId);
  const result = await ttlock<{ list?: { lockId: number; lockName: string; lockAlias?: string }[] }>("/v3/lock/list", { clientId: stored.clientId, accessToken: token.access_token, pageNo: 1, pageSize: 1000, date: Date.now() });
  return result.list ?? [];
}

export async function assignTTLockAction(formData: FormData) {
  const hotelId = await requireSessionHotelId({ permission: "ROOMS" });
  const roomId = String(formData.get("roomId") ?? "");
  const lockId = String(formData.get("lockId") ?? "");
  const { stored, token } = await credentials(hotelId);
  const result = await ttlock<{ list?: { lockId: number; lockName: string; lockAlias?: string }[] }>("/v3/lock/list", { clientId: stored.clientId, accessToken: token.access_token, pageNo: 1, pageSize: 1000, date: Date.now() });
  const verified = result.list?.find((item) => String(item.lockId) === lockId);
  const room = await db.room.findFirst({ where: { id: roomId, hotelId }, select: { id: true } });
  if (!room || !verified) throw new Error("Выберите замок из вашего подключённого аккаунта TTLock");
  await db.tTLockLock.upsert({ where: { roomId }, create: { hotelId, roomId, lockId, lockName: verified.lockName, lockAlias: verified.lockAlias ?? null }, update: { lockId, lockName: verified.lockName, lockAlias: verified.lockAlias ?? null } });
  revalidatePath("/dashboard/locks");
}

export async function issueReservationPasscodeAction(formData: FormData) {
  const hotelId = await requireSessionHotelId({ permission: "RESERVATIONS" });
  const reservationId = String(formData.get("reservationId") ?? "");
  const reservation = await db.reservation.findFirst({ where: { id: reservationId, hotelId, status: { notIn: ["CANCELLED", "NO_SHOW"] } }, include: { room: { include: { ttlockLock: true } }, guest: true } });
  if (!reservation?.room.ttlockLock) throw new Error("К бронированию не привязан замок TTLock");
  const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { timezone: true } });
  const { stored, token } = await credentials(hotelId);
  const startDate = Math.ceil(zonedTime(reservation.checkIn, reservation.checkInTime, hotel.timezone) / 3_600_000) * 3_600_000;
  const endDate = Math.floor(zonedTime(reservation.checkOut, reservation.checkOutTime, hotel.timezone) / 3_600_000) * 3_600_000;
  if (endDate <= startDate) throw new Error("Период проживания слишком короткий для кода TTLock");
  const name = `Shanyraq ${reservation.guest.fullName}`.slice(0, 30);
  const generated = await ttlock<{ keyboardPwd: string }>("/v3/keyboardPwd/get", { clientId: stored.clientId, accessToken: token.access_token, lockId: reservation.room.ttlockLock.lockId, keyboardPwdVersion: 4, keyboardPwdType: 3, keyboardPwdName: name, startDate, endDate, date: Date.now() });
  const added = await ttlock<{ keyboardPwdId: number }>("/v3/keyboardPwd/add", { clientId: stored.clientId, accessToken: token.access_token, lockId: reservation.room.ttlockLock.lockId, keyboardPwd: generated.keyboardPwd, keyboardPwdName: name, startDate, endDate, addType: 2, date: Date.now() });
  await db.tTLockPasscode.create({ data: { hotelId, lockId: reservation.room.ttlockLock.id, reservationId, keyboardPwdId: String(added.keyboardPwdId), code: generated.keyboardPwd, name, startsAt: new Date(startDate), endsAt: new Date(endDate) } });
  revalidatePath("/dashboard/locks");
  revalidatePath(`/dashboard/reservations/${reservationId}`);
}
