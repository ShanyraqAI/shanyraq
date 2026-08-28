import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/tenant";

export async function POST(request: Request) {
  try {
    // Check if user is authenticated and onboarding is not complete
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401 });
    }

    if (user.onboardingCompleted) {
      return NextResponse.json({ ok: true });
    }

    const body = await request.json();
    const {
      hotelName,
      city,
      country,
      language,
      currency,
      timezone,
      propertyType,
    } = body;

    // Validate required fields
    if (!hotelName?.trim()) {
      return NextResponse.json({ ok: false, error: "Название отеля обязательно" }, { status: 400 });
    }
    if (!city?.trim()) {
      return NextResponse.json({ ok: false, error: "Город обязателен" }, { status: 400 });
    }
    if (!propertyType) {
      return NextResponse.json({ ok: false, error: "Тип объекта обязателен" }, { status: 400 });
    }
    // Update or create hotel with onboarding data
    let hotelId = user.hotelId;
    if (hotelId) {
      await db.hotel.update({
        where: { id: hotelId },
        data: { name: hotelName, city, country, propertyType, language: language || "ru", timezone, currency },
      });
    } else {
      // Legacy user without hotel — create one now
      const org = user.organizationId
        ? await db.organization.findUnique({ where: { id: user.organizationId } })
        : await db.organization.create({ data: { name: `${hotelName} — Организация` } });
      const newHotel = await db.hotel.create({
        data: {
          orgId: org!.id,
          slug: `hotel-${user.id.slice(0, 8)}-${Date.now().toString(36)}`,
          name: hotelName,
          city,
          country,
          propertyType,
          language: language || "ru",
          timezone,
          currency,
        },
      });
      hotelId = newHotel.id;
      if (user.membershipId) {
        await db.membership.update({ where: { id: user.membershipId }, data: { hotelId } });
      } else if (user.organizationId) {
        await db.membership.create({ data: { organizationId: user.organizationId, userId: user.id, hotelId, role: "OWNER" } });
      }
    }

    // Update user preferences
    await db.user.update({
      where: { id: user.id },
      data: {
        onboardingCompleted: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { ok: false, error: "Не удалось завершить онбординг" },
      { status: 500 }
    );
  }
}
