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
      roomTypes,
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
    if (!roomTypes?.length) {
      return NextResponse.json({ ok: false, error: "Добавьте хотя бы один тип номера" }, { status: 400 });
    }

    // Update hotel with onboarding data
    await db.hotel.update({
      where: { id: user.hotelId },
      data: {
        name: hotelName,
        city,
        country,
        propertyType,
        language: language || "ru",
        timezone,
        currency,
      },
    });

    // Update user preferences
    await db.user.update({
      where: { id: user.id },
      data: {
        onboardingCompleted: true,
      },
    });

    // Create room types and rooms (101, 102, ... per type)
    let roomSortOrder = 0;
    for (const rt of roomTypes) {
      const roomType = await db.roomType.create({
        data: {
          hotelId: user.hotelId,
          name: rt.name,
          capacity: rt.capacity,
          basePrice: rt.basePrice,
          sortOrder: roomSortOrder++,
        },
      });

      const rooms = [];
      for (let i = 1; i <= rt.count; i++) {
        const floor = Math.ceil(i / 10);
        const number = `${floor}${String(i).padStart(2, "0")}`;
        // 101..110, 201..210 etc. For count <=10: 101..110
        const roomNumber = rt.count <= 10 ? `${100 + i}` : number;
        rooms.push({
          hotelId: user.hotelId,
          roomTypeId: roomType.id,
          number: roomNumber,
          floor,
          status: "AVAILABLE",
        });
      }
      await db.room.createMany({ data: rooms });
    }

    // Create a default rate plan for the first room type
    const firstRoomType = await db.roomType.findFirst({ where: { hotelId: user.hotelId }, select: { id: true } });
    if (firstRoomType) {
      await db.ratePlan.create({
        data: {
          hotelId: user.hotelId,
          roomTypeId: firstRoomType.id,
          name: "Базовый тариф",
          basePrice: roomTypes[0]?.basePrice || 35000,
          currency,
          refundable: true,
          breakfastIncluded: false,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { ok: false, error: "Не удалось завершить онбординг" },
      { status: 500 }
    );
  }
}