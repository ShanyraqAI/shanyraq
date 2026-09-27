import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { buildPropertyInput, buildRatePlanInput, buildRoomTypeInput, toChannexPropertyType } from "./provisioning-inputs";

test("builds a Kazakhstan short-term rental property without automatic inventory changes", () => {
  assert.deepEqual(buildPropertyInput({
    publicName: "Апартаменты на Абая",
    propertyType: "Квартира",
    address: "проспект Абая, 10",
    city: "Алматы",
    country: null,
    timezone: "Asia/Almaty",
    currency: "kzt",
  }), {
    title: "Апартаменты на Абая",
    property_type: "apartment",
    address: "проспект Абая, 10",
    city: "Алматы",
    country: "KZ",
    timezone: "Asia/Almaty",
    currency: "KZT",
    settings: {
      allow_availability_autoupdate_on_modification: false,
      allow_availability_autoupdate_on_cancellation: false,
      min_stay_type: "both",
      state_length: 500,
    },
  });
  assert.equal(toChannexPropertyType("apart-hotel"), "apart_hotel");
});

test("uses physical unit count and local occupancy for a room type", () => {
  assert.deepEqual(buildRoomTypeInput("property-1", {
    name: "Студия",
    description: "С отдельной кухней",
    capacity: 2,
    roomCount: 3,
  }), {
    property_id: "property-1",
    title: "Студия",
    count_of_rooms: 3,
    occ_adults: 2,
    occ_children: 0,
    occ_infants: 0,
    default_occupancy: 2,
    facilities: [],
    room_kind: "room",
    content: { description: "С отдельной кухней" },
  });
});

test("uses the actual KZT base price for a manual rate plan", () => {
  assert.deepEqual(buildRatePlanInput("property-1", "room-type-1", {
    name: "Основной",
    currency: "KZT",
    basePrice: new Prisma.Decimal("25000"),
    breakfastIncluded: false,
    occupancy: 2,
  }), {
    property_id: "property-1",
    room_type_id: "room-type-1",
    title: "Основной",
    currency: "KZT",
    sell_mode: "per_room",
    rate_mode: "manual",
    meal_type: "room_only",
    options: [{ occupancy: 2, is_primary: true, rate: "25000.00" }],
  });
});

test("rejects room types without a physical unit", () => {
  assert.throws(
    () => buildRoomTypeInput("property-1", { name: "Студия", description: null, capacity: 2, roomCount: 0 }),
    /Добавьте хотя бы одну единицу/,
  );
});
