"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/security/credentials";
import { requireSessionHotelId } from "@/server/guards";

type Credentials = { clientId: string; clientSecret: string; username: string; password?: string; accessToken?: string; refreshToken?: string; tokenExpiresAt?: number };
type Token = { access_token: string; refresh_token?: string; expires_in?: number };
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
  const storedCredentials = decryptSecret<Credentials>(row.credentials);
  let stored: Credentials = {
    ...storedCredentials,
    clientId: process.env.TTLOCK_CLIENT_ID?.trim() || storedCredentials.clientId,
    clientSecret: process.env.TTLOCK_CLIENT_SECRET?.trim() || storedCredentials.clientSecret,
  };
  let token: Token;
  if (stored.accessToken && stored.tokenExpiresAt && stored.tokenExpiresAt > Date.now() + 60_000) {
    token = { access_token: stored.accessToken, refresh_token: stored.refreshToken };
    return { stored, token };
  } else if (stored.refreshToken) {
    token = await ttlock<Token>("/oauth2/token", { client_id: stored.clientId, client_secret: stored.clientSecret, refresh_token: stored.refreshToken, grant_type: "refresh_token" });
  } else if (stored.password) {
    token = await ttlock<Token>("/oauth2/token", { client_id: stored.clientId, client_secret: stored.clientSecret, username: stored.username, password: createHash("md5").update(stored.password).digest("hex"), grant_type: "password" });
  } else {
    throw new Error("Срок авторизации TTLock истёк. Подключите аккаунт повторно");
  }
  const tokenExpiresAt = Date.now() + (token.expires_in ?? 7_776_000) * 1000;
  const nextRefreshToken = token.refresh_token ?? stored.refreshToken;
  stored = { ...stored, accessToken: token.access_token, refreshToken: nextRefreshToken, tokenExpiresAt };
  delete stored.password;
  await db.tTLockConnection.update({ where: { id: row.id }, data: { credentials: encryptSecret(stored) } });
  return { stored, token };
}

export async function saveTTLockConnectionAction(formData: FormData) {
  const hotelId = await requireSessionHotelId({ permission: "ROOMS" });
  const values = {
    clientId: process.env.TTLOCK_CLIENT_ID?.trim() || String(formData.get("clientId") ?? "").trim(),
    clientSecret: process.env.TTLOCK_CLIENT_SECRET?.trim() || String(formData.get("clientSecret") ?? "").trim(),
    username: String(formData.get("username") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
  if (Object.values(values).some((value) => !value)) throw new Error("Заполните все поля TTLock");
  const token = await ttlock<Token>("/oauth2/token", { client_id: values.clientId, client_secret: values.clientSecret, username: values.username, password: createHash("md5").update(values.password).digest("hex"), grant_type: "password" });
  const persistedValues = process.env.TTLOCK_CLIENT_ID?.trim() && process.env.TTLOCK_CLIENT_SECRET?.trim()
    ? { clientId: "", clientSecret: "", username: values.username }
    : { clientId: values.clientId, clientSecret: values.clientSecret, username: values.username };
  const tokenExpiresAt = Date.now() + (token.expires_in ?? 7_776_000) * 1000;
  const connectionCredentials: Credentials = { ...persistedValues, accessToken: token.access_token, refreshToken: token.refresh_token, tokenExpiresAt };
  await db.tTLockConnection.upsert({ where: { hotelId }, create: { hotelId, credentials: encryptSecret(connectionCredentials) }, update: { credentials: encryptSecret(connectionCredentials) } });
  revalidatePath("/dashboard/locks");
}

export async function syncTTLockLocksAction() {
  const hotelId = await requireSessionHotelId({ permission: "ROOMS" });
  const { stored, token } = await credentials(hotelId);
  const result = await ttlock<{ list?: { lockId: number; lockName: string; lockAlias?: string; electricQuantity?: number; hasGateway?: number; keyboardPwdVersion?: number }[] }>("/v3/lock/list", { clientId: stored.clientId, accessToken: token.access_token, pageNo: 1, pageSize: 1000, date: Date.now() });
  const devices = result.list ?? [];
  const mapped = await db.tTLockLock.findMany({ where: { hotelId } });
  await Promise.all(mapped.map(async (lock) => {
    const device = devices.find((item) => String(item.lockId) === lock.lockId);
    if (!device) return;
    await db.tTLockLock.update({ where: { id: lock.id }, data: { lockName: device.lockName, lockAlias: device.lockAlias ?? null, batteryPercent: device.electricQuantity ?? null, keyboardPwdVersion: device.keyboardPwdVersion ?? null, hasGateway: device.hasGateway === undefined ? null : device.hasGateway === 1, lastSyncedAt: new Date() } });
  }));
  revalidatePath("/dashboard/locks");
  return devices;
}

export async function getTTLockOperationsDataAction(lockRecordId: string) {
  const hotelId = await requireSessionHotelId({ permission: "ROOMS" });
  const lock = await db.tTLockLock.findFirst({ where: { id: lockRecordId, hotelId } });
  if (!lock) throw new Error("Замок не найден в этом объекте");
  const { stored, token } = await credentials(hotelId);
  const common = { clientId: stored.clientId, accessToken: token.access_token, lockId: lock.lockId, date: Date.now() };
  const [details, state, records, codes] = await Promise.all([
    ttlock<{ electricQuantity?: number; hasGateway?: number; isOnline?: number; lockName?: string; lockAlias?: string }>("/v3/lock/detail", common),
    ttlock<{ state?: number }>("/v3/lock/queryOpenState", common),
    ttlock<{ list?: { recordType: number; success: number; username?: string; keyboardPwd?: string; lockDate: number; serverDate?: number }[] }>("/v3/lockRecord/list", { ...common, pageNo: 1, pageSize: 50, startDate: 0, endDate: 0 }),
    ttlock<{ list?: { keyboardPwdId: number; keyboardPwd: string; keyboardPwdName?: string; startDate: number; endDate: number; status?: number }[] }>("/v3/lock/listKeyboardPwd", { ...common, pageNo: 1, pageSize: 100 }),
  ]);
  const lockState = state.state === 0 ? "LOCKED" : state.state === 1 ? "UNLOCKED" : "UNKNOWN";
  await db.tTLockLock.update({ where: { id: lock.id }, data: { lockName: details.lockName ?? lock.lockName, lockAlias: details.lockAlias ?? lock.lockAlias, batteryPercent: details.electricQuantity ?? lock.batteryPercent, hasGateway: details.hasGateway === undefined ? lock.hasGateway : details.hasGateway === 1, isOnline: details.isOnline === undefined ? (details.hasGateway === undefined ? lock.isOnline : details.hasGateway === 1) : details.isOnline === 1, lockState, lastSyncedAt: new Date() } });
  const remotePasscodes = (codes.list ?? []).filter((item) => item.startDate > 0 && item.endDate > 0 && Number.isFinite(item.startDate) && Number.isFinite(item.endDate));
  await Promise.all(remotePasscodes.map((item) => {
    const status = item.status === 5 || item.status === 7 || item.status === 9 ? "FAILED" : item.status === 3 || item.status === 4 || item.status === 6 || item.status === 8 ? "PENDING" : item.status === 2 || item.endDate <= Date.now() ? "EXPIRED" : "ACTIVE";
    return db.tTLockPasscode.upsert({ where: { lockId_keyboardPwdId: { lockId: lock.id, keyboardPwdId: String(item.keyboardPwdId) } }, create: { hotelId, lockId: lock.id, keyboardPwdId: String(item.keyboardPwdId), code: item.keyboardPwd, name: item.keyboardPwdName ?? "Код TTLock", startsAt: new Date(item.startDate), endsAt: new Date(item.endDate), status }, update: { code: item.keyboardPwd, name: item.keyboardPwdName ?? "Код TTLock", startsAt: new Date(item.startDate), endsAt: new Date(item.endDate), status } });
  }));
  revalidatePath("/dashboard/locks");
  return {
    state: lockState,
    batteryPercent: details.electricQuantity ?? lock.batteryPercent,
    isOnline: details.isOnline === undefined ? (details.hasGateway === undefined ? lock.isOnline : details.hasGateway === 1) : details.isOnline === 1,
    records: (records.list ?? []).map(({ keyboardPwd: _secret, ...record }) => record),
    passcodes: remotePasscodes.map((item) => ({ id: String(item.keyboardPwdId), code: item.keyboardPwd, name: item.keyboardPwdName ?? "Код", startsAt: item.startDate, endsAt: item.endDate, status: item.status ?? 1 })),
  };
}

export async function controlTTLockAction(lockRecordId: string, command: "lock" | "unlock") {
  const hotelId = await requireSessionHotelId({ permission: "ROOMS" });
  const lock = await db.tTLockLock.findFirst({ where: { id: lockRecordId, hotelId }, select: { id: true, lockId: true } });
  if (!lock) throw new Error("Замок не найден в этом объекте");
  const { stored, token } = await credentials(hotelId);
  await ttlock(command === "lock" ? "/v3/lock/lock" : "/v3/lock/unlock", { clientId: stored.clientId, accessToken: token.access_token, lockId: lock.lockId, date: Date.now() });
  await db.tTLockLock.update({ where: { id: lock.id }, data: { lockState: command === "lock" ? "LOCKED" : "UNLOCKED", lastSyncedAt: new Date() } });
  revalidatePath("/dashboard/locks");
  return command;
}

export async function revokeTTLockPasscodeAction(passcodeRecordId: string) {
  const hotelId = await requireSessionHotelId({ permission: "ROOMS" });
  const passcode = await db.tTLockPasscode.findFirst({ where: { id: passcodeRecordId, hotelId, status: "ACTIVE" }, include: { lock: true } });
  if (!passcode) throw new Error("Активный код не найден");
  const { stored, token } = await credentials(hotelId);
  await ttlock("/v3/keyboardPwd/delete", { clientId: stored.clientId, accessToken: token.access_token, lockId: passcode.lock.lockId, keyboardPwdId: passcode.keyboardPwdId, deleteType: 2, date: Date.now() });
  await db.tTLockPasscode.update({ where: { id: passcode.id }, data: { status: "REVOKED" } });
  revalidatePath("/dashboard/locks");
  if (passcode.reservationId) revalidatePath(`/dashboard/reservations/${passcode.reservationId}`);
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

export async function issueReservationPasscodeAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const hotelId = await requireSessionHotelId({ permission: "RESERVATIONS" });
  try {
    const reservationId = String(formData.get("reservationId") ?? "");
    const reservation = await db.reservation.findFirst({ where: { id: reservationId, hotelId, status: { notIn: ["CANCELLED", "NO_SHOW"] } }, include: { room: { include: { ttlockLock: true } }, guest: true } });
    if (!reservation?.room.ttlockLock) return { ok: false, error: "Сначала подключите TTLock и привяжите замок к этой квартире" };
    const existing = await db.tTLockPasscode.findFirst({ where: { hotelId, reservationId, status: "ACTIVE", endsAt: { gt: new Date() } }, select: { id: true } });
    if (existing) return { ok: false, error: "Для этого бронирования уже создан активный TTLock-код" };
    const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { timezone: true } });
    const { stored, token } = await credentials(hotelId);
    const lockDetails = await ttlock<{ keyboardPwdVersion?: number }>("/v3/lock/detail", { clientId: stored.clientId, accessToken: token.access_token, lockId: reservation.room.ttlockLock.lockId, date: Date.now() });
    if (lockDetails.keyboardPwdVersion !== 4) return { ok: false, error: "Этот замок не поддерживает временные коды V4 через TTLock Open Platform" };
    const startDate = Math.ceil(zonedTime(reservation.checkIn, reservation.checkInTime, hotel.timezone) / 3_600_000) * 3_600_000;
    const endDate = Math.floor(zonedTime(reservation.checkOut, reservation.checkOutTime, hotel.timezone) / 3_600_000) * 3_600_000;
    if (endDate <= startDate) return { ok: false, error: "Период проживания слишком короткий для кода TTLock" };
    const name = `Shanyraq ${reservation.guest.fullName}`.slice(0, 30);
    const generated = await ttlock<{ keyboardPwd: string }>("/v3/keyboardPwd/get", { clientId: stored.clientId, accessToken: token.access_token, lockId: reservation.room.ttlockLock.lockId, keyboardPwdVersion: 4, keyboardPwdType: 3, keyboardPwdName: name, startDate, endDate, date: Date.now() });
    const added = await ttlock<{ keyboardPwdId: number }>("/v3/keyboardPwd/add", { clientId: stored.clientId, accessToken: token.access_token, lockId: reservation.room.ttlockLock.lockId, keyboardPwd: generated.keyboardPwd, keyboardPwdName: name, startDate, endDate, addType: 2, date: Date.now() });
    await db.tTLockPasscode.create({ data: { hotelId, lockId: reservation.room.ttlockLock.id, reservationId, keyboardPwdId: String(added.keyboardPwdId), code: generated.keyboardPwd, name, startsAt: new Date(startDate), endsAt: new Date(endDate) } });
    revalidatePath("/dashboard/locks");
    revalidatePath(`/dashboard/reservations/${reservationId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось создать код TTLock" };
  }
}
