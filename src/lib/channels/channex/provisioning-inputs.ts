import { PublicError } from "@/server/errors";
import type { ChannexPropertyInput, ChannexRatePlanInput, ChannexRoomTypeInput } from "./client";

const PROPERTY_TYPES = new Set([
  "hotel", "motel", "resort", "inn", "guest_house", "apartment", "holiday_home",
  "villa", "hostel", "apart_hotel", "bed_and_breakfast", "camping", "farm_stay",
]);

function cleanOptional(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

export function toChannexPropertyType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    flat: "apartment",
    квартира: "apartment",
    house: "holiday_home",
    дом: "holiday_home",
    guesthouse: "guest_house",
    aparthotel: "apart_hotel",
  };
  const resolved = normalized ? aliases[normalized] ?? normalized : "apartment";
  return PROPERTY_TYPES.has(resolved) ? resolved : "apartment";
}

export function buildPropertyInput(rentalProperty: {
  publicName: string;
  propertyType: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  currency: string;
}): ChannexPropertyInput {
  const currency = rentalProperty.currency.trim().toUpperCase();
  if (!rentalProperty.publicName.trim()) throw new PublicError("Укажите название объекта в настройках.");
  if (!/^[A-Z]{3}$/.test(currency)) throw new PublicError("Укажите корректную трёхбуквенную валюту объекта.");
  if (!rentalProperty.timezone.trim()) throw new PublicError("Укажите часовой пояс объекта.");
  const country = rentalProperty.country?.trim().toUpperCase() || "KZ";
  const address = cleanOptional(rentalProperty.address);
  const city = cleanOptional(rentalProperty.city);
  return {
    title: rentalProperty.publicName.trim(), currency, timezone: rentalProperty.timezone.trim(),
    property_type: toChannexPropertyType(rentalProperty.propertyType),
    ...(address ? { address } : {}), ...(city ? { city } : {}),
    ...(country.length === 2 ? { country } : {}),
    settings: {
      allow_availability_autoupdate_on_modification: false,
      allow_availability_autoupdate_on_cancellation: false,
      min_stay_type: "both", state_length: 500,
    },
  };
}

export function buildRoomTypeInput(propertyId: string, roomType: {
  name: string; description: string | null; capacity: number; roomCount: number;
}): ChannexRoomTypeInput {
  if (!roomType.name.trim()) throw new PublicError("У типа размещения отсутствует название.");
  if (!Number.isInteger(roomType.capacity) || roomType.capacity < 1 || roomType.capacity > 18) {
    throw new PublicError(`Вместимость «${roomType.name}» должна быть от 1 до 18 гостей.`);
  }
  if (!Number.isInteger(roomType.roomCount) || roomType.roomCount < 1) {
    throw new PublicError(`Добавьте хотя бы одну единицу размещения для «${roomType.name}».`);
  }
  const description = cleanOptional(roomType.description);
  return {
    property_id: propertyId, title: roomType.name.trim(), count_of_rooms: roomType.roomCount,
    occ_adults: roomType.capacity, occ_children: 0, occ_infants: 0,
    default_occupancy: roomType.capacity, facilities: [], room_kind: "room",
    ...(description ? { content: { description } } : {}),
  };
}

export function buildRatePlanInput(propertyId: string, roomTypeId: string, ratePlan: {
  name: string; currency: string; basePrice: { toFixed(digits: number): string };
  breakfastIncluded: boolean; occupancy: number;
}): ChannexRatePlanInput {
  const currency = ratePlan.currency.trim().toUpperCase();
  const rate = ratePlan.basePrice.toFixed(2);
  if (!ratePlan.name.trim()) throw new PublicError("У тарифа отсутствует название.");
  if (!/^[A-Z]{3}$/.test(currency)) throw new PublicError(`Проверьте валюту тарифа «${ratePlan.name}».`);
  if (!Number.isFinite(Number(rate)) || Number(rate) <= 0) throw new PublicError(`Цена тарифа «${ratePlan.name}» должна быть больше нуля.`);
  return {
    property_id: propertyId, room_type_id: roomTypeId, title: ratePlan.name.trim(), currency,
    sell_mode: "per_room", rate_mode: "manual",
    meal_type: ratePlan.breakfastIncluded ? "breakfast" : "room_only",
    options: [{ occupancy: ratePlan.occupancy, is_primary: true, rate }],
  };
}
