import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/tenant";
import { syncDefaultRentalProperty } from "@/lib/rental-properties";

const hotelDetailsSchema = z.object({
  action: z.literal("save-hotel"),
  hotelName: z.string().trim().min(2, "Название отеля обязательно").max(120),
  city: z.string().trim().min(2, "Город обязателен").max(120),
  country: z.string().trim().min(2).max(120),
  language: z.enum(["ru", "kk", "en"]).default("ru"),
  currency: z.enum(["KZT", "USD", "EUR"]),
  timezone: z.string().trim().max(64).refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, "Некорректный часовой пояс"),
  propertyType: z.enum(["Отель", "Апарт-отель", "Апартаменты", "Хостел", "Гостевой дом", "Другое"]),
});

const onboardingSchema = z.discriminatedUnion("action", [
  hotelDetailsSchema,
  z.object({ action: z.literal("room-created") }),
  z.object({ action: z.literal("complete"), skipReservation: z.boolean().default(false) }),
]);

function validOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const configured = process.env.APP_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  return Boolean(origin && configured && new URL(origin).origin === new URL(configured).origin);
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

    const parsed = onboardingSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" }, { status: 400 });
    const now = new Date();

    if (parsed.data.action === "save-hotel") {
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

    await db.$transaction([
      db.hotel.updateMany({ where: { id: user.hotelId, orgId: user.organizationId }, data: { propertyType: "Апартаменты", country: "Казахстан", currency: "KZT", timezone: "Asia/Almaty" } }),
      db.user.update({ where: { id: user.id }, data: { onboardingCompleted: true } }),
      db.productExperience.upsert({
        where: { userId_hotelId: { userId: user.id, hotelId: user.hotelId } },
        create: { userId: user.id, hotelId: user.hotelId, setupStep: 3, setupCompletedAt: now, lastSeenAt: now },
        update: { setupStep: 3, setupCompletedAt: now, lastSeenAt: now },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Onboarding error", { incidentId: crypto.randomUUID(), error: error instanceof Error ? error.name : "Unknown" });
    return NextResponse.json({ ok: false, error: "Не удалось сохранить шаг настройки" }, { status: 500 });
  }
}
