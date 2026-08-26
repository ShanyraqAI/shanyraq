import type { ChannelCode } from "@/lib/constants";
import { BaseMockProvider, type MockProviderConfig } from "../mock/base-mock-provider";

/** MockOstrovokProvider вЂ” simulates the Ostrovok API adapter. */
export class MockOstrovokProvider extends BaseMockProvider {
  readonly code: ChannelCode = "ostrovok";

  protected config: MockProviderConfig = {
    code: "ostrovok",
    label: "Ostrovok",
    batchLimit: 2,
    inventory: {
      roomTypes: [
        { id: "rt_std_01", name: "Стандартный двухместный", capacity: 2 },
        { id: "rt_dlxE_02", name: "Делюкс с кроватью king-size", capacity: 3 },
        { id: "rt_suit_09", name: "Люкс «Executive»", capacity: 4 },
      ],
      ratePlans: [
        { id: "rp_std_flex", name: "Гибкий тариф «Стандарт»", appliesToRoomTypeIds: ["rt_std_01"] },
        { id: "rp_std_nrfnd", name: "Невозвратный тариф «Стандарт»", appliesToRoomTypeIds: ["rt_std_01"] },
        { id: "rp_dlx_flex", name: "Гибкий тариф «Делюкс»", appliesToRoomTypeIds: ["rt_dlxE_02"] },
        { id: "rp_suit_bb", name: "Люкс с завтраком", appliesToRoomTypeIds: ["rt_suit_09"] },
      ],
    },
    reservationTemplates: [
      {
        externalRoomTypeId: "rt_std_01",
        guestName: "Ivan Sokolov",
        guestEmail: "ivan.sokolov@example.ru",
        guestCountry: "Россия",
        offsetFromToday: 6,
        nights: 1,
        adults: 1,
        children: 0,
        baseAmount: 24000,
      },
      {
        externalRoomTypeId: "rt_dlxE_02",
        guestName: "Gulnara Karimova",
        guestEmail: "gulnara.k@example.kz",
        guestCountry: "Казахстан",
        offsetFromToday: 6,
        nights: 2,
        adults: 2,
        children: 0,
        baseAmount: 37000,
      },
      {
        externalRoomTypeId: "rt_suit_09",
        guestName: "Hans MГјller",
        guestEmail: "hans.mueller@example.de",
        guestCountry: "Германия",
        offsetFromToday: 4,
        nights: 3,
        adults: 2,
        children: 1,
        baseAmount: 68000,
      },
      {
        externalRoomTypeId: "rt_std_01",
        guestName: "Aylin Demir",
        guestEmail: "aylin.demir@example.tr",
        guestCountry: "Турция",
        offsetFromToday: 10,
        nights: 2,
        adults: 2,
        children: 0,
        baseAmount: 24500,
      },
      {
        externalRoomTypeId: "rt_dlxE_02",
        guestName: "Arman Zhaksybaev",
        guestEmail: "arman.z@example.kz",
        guestCountry: "Казахстан",
        offsetFromToday: 15,
        nights: 4,
        adults: 2,
        children: 2,
        baseAmount: 36000,
      },
      {
        externalRoomTypeId: "rt_std_01",
        guestName: "Nina Ivanova",
        guestEmail: "nina.ivanova@example.ru",
        guestCountry: "Россия",
        offsetFromToday: 17,
        nights: 2,
        adults: 1,
        children: 0,
        baseAmount: 23500,
        cancelled: true,
      },
      {
        externalRoomTypeId: "rt_suit_09",
        guestName: "Viktor Petrov",
        guestEmail: "v.petrov@example.ru",
        guestCountry: "Россия",
        offsetFromToday: 19,
        nights: 2,
        adults: 3,
        children: 0,
        baseAmount: 71000,
      },
    ],
  };
}
