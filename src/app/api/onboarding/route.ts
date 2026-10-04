import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/tenant";
import { syncDefaultRentalProperty } from "@/lib/rental-properties";
import { isValidTimeZone } from "@/lib/dates";

const hotelDetailsSchema = z.object({
  action: z.literal("save-hotel"),
  hotelName: z.string().trim().min(2, "Название отеля обязательно").max(120),
  city: z.string().trim().min(2, "Город обязателен").max(120),
  country: z.string().trim().min(2).max(120),
  language: z.enum(["ru", "kk", "en"]).default("ru"),
  currency: z.enum(["KZT", "USD", "EUR"]),
  timezone: z.string().trim().max(64).refine(isValidTimeZone, "Некорректный часовой пояс"),
  propertyType: z.enum(["Отель", "Апарт-отель", "Апартаменты", "Хостел", "Гостевой дом", "Другое"]),
});

const onboardingSchema = z.discriminatedUnion("action", [
  hotelDetailsSchema,
  z.object({ action: z.literal("room-created") }),
  z.object({ action: z.literal("complete"), skipReservation: z.boolean().default(false) }),
]);

function validOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestOrigin = new URL(request.url).origin;
    const allowedOrigins = new Set([requestOrigin]);
    const configured = process.env.APP_URL;
    if (configured) allowedOrigins.add(new URL(configured).origin);
    if (process.env.NODE_ENV === "development") allowedOrigins.add("http://localhost:3000");
    return allowedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    if (!validOrigin(request)) return NextResponse.json({ ok: false, error: "Недопустимый источник запроса" }, { status: 403 });
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 10_000) return NextResponse.json({ ok: false, error: "Слишком большой запрос" }, { status: 413 });
    const user = await getCurrentUser();
    if (!user?.hotelId || !user.organizationId) {
      return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
    }
    if (user.onboardingCompleted) return NextResponse.json({ ok: true });
    // Onboarding is per user, but hotel settings are shared: only the owner may change them.
    const isOwner = user.role === "OWNER";

    const parsed = onboardingSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" }, { status: 400 });
    const now = new Date();

    if (parsed.data.action === "save-hotel") {
      if (!isOwner) return NextResponse.json({ ok: false, error: "Только владелец может изменить настройки объекта" }, { status: 403 });
      const data = parsed.data;
      await db.$transaction(async (tx) => {
        const updated = await tx.hotel.updateMany({
          where: { id: user.hotelId!, orgId: user.organizationId! },
          data: { name: data.hotelName, city: data.city, country: data.country, propertyType: data.propertyType, language: data.language, timezone: data.timezone, currency: data.currency },
        });
        if (updated.count !== 1) throw new Error("Hotel unavailable during onboarding");
        const hotel = await tx.hotel.findUniqueOrThrow({ where: { id: user.hotelId! } });
        await syncDefaultRentalProperty(tx, hotel);
        const current = await tx.productExperience.findUnique({
          where: { userId_hotelId: { userId: user.id, hotelId: user.hotelId! } },
          select: { setupStep: true },
        });
        await tx.productExperience.upsert({
          where: { userId_hotelId: { userId: user.id, hotelId: user.hotelId! } },
          create: { userId: user.id, hotelId: user.hotelId!, setupStep: 2, lastSeenAt: now },
          update: { setupStep: Math.max(2, current?.setupStep ?? 1), lastSeenAt: now },
        });
      });
      return NextResponse.json({ ok: true, nextStep: 2 });
    }

    const roomCount = await db.room.count({ where: { hotelId: user.hotelId } });
    if (roomCount === 0) return NextResponse.json({ ok: false, error: "Сначала добавьте первый номер" }, { status: 409 });

    if (parsed.data.action === "room-created") {
      await db.productExperience.upsert({
        where: { userId_hotelId: { userId: user.id, hotelId: user.hotelId } },
        create: { userId: user.id, hotelId: user.hotelId, setupStep: 3, lastSeenAt: now },
        update: { setupStep: 3, lastSeenAt: now },
      });
      return NextResponse.json({ ok: true, nextStep: 3 });
    }

    if (!parsed.data.skipReservation) {
      const reservationCount = await db.reservation.count({ where: { hotelId: user.hotelId } });
      if (reservationCount === 0) return NextResponse.json({ ok: false, error: "Сначала создайте бронирование или выберите «Сделать позже»" }, { status: 409 });
    }

    const hotelId = user.hotelId;
    const organizationId = user.organizationId;
    await db.$transaction(async (tx) => {
      if (isOwner) {
        // Fill only a missing type; settings the owner already saved must survive completion.
        const filled = await tx.hotel.updateMany({ where: { id: hotelId, orgId: organizationId, propertyType: null }, data: { propertyType: "Апартаменты" } });
        if (filled.count === 1) await syncDefaultRentalProperty(tx, await tx.hotel.findUniqueOrThrow({ where: { id: hotelId } }));
      }
      await tx.user.update({ where: { id: user.id }, data: { onboardingCompleted: true } });
      await tx.productExperience.upsert({
        where: { userId_hotelId: { userId: user.id, hotelId } },
        create: { userId: user.id, hotelId, setupStep: 3, setupCompletedAt: now, lastSeenAt: now },
        update: { setupStep: 3, setupCompletedAt: now, lastSeenAt: now },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Onboarding error", { incidentId: crypto.randomUUID(), error: error instanceof Error ? error.name : "Unknown" });
    return NextResponse.json({ ok: false, error: "Не удалось сохранить шаг настройки" }, { status: 500 });
  }
}
