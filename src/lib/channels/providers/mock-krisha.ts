import type { ChannelCode } from "@/lib/constants";
import { BaseMockProvider, type MockProviderConfig } from "../mock/base-mock-provider";

/** MockKrishaProvider вЂ” local Kazakhstan marketplace adapter (mock). */
export class MockKrishaProvider extends BaseMockProvider {
  readonly code: ChannelCode = "krisha";

  protected config: MockProviderConfig = {
    code: "krisha",
    label: "Krisha",
    batchLimit: 2,
    inventory: {
      roomTypes: [
        { id: "kr-std-a", name: "Стандарт", capacity: 2 },
        { id: "kr-dlx-b", name: "Комфорт плюс", capacity: 3 },
        { id: "kr-suit-c", name: "Семейный люкс", capacity: 4 },
      ],
      ratePlans: [
        { id: "kr-rp-1", name: "Посуточно «Стандарт»", appliesToRoomTypeIds: ["kr-std-a"] },
        { id: "kr-rp-2", name: "Посуточно «Комфорт»", appliesToRoomTypeIds: ["kr-dlx-b"] },
        { id: "kr-rp-3", name: "Посуточно «Люкс»", appliesToRoomTypeIds: ["kr-suit-c"] },
      ],
    },
    reservationTemplates: [
      {
        externalRoomTypeId: "kr-std-a",
        guestName: "Madina Ospanova",
        guestEmail: "madina.o@example.kz",
        guestCountry: "Казахстан",
        offsetFromToday: 11,
        nights: 2,
        adults: 2,
        children: 0,
        baseAmount: 23000,
      },
      {
        externalRoomTypeId: "kr-dlx-b",
        guestName: "Timur Bekturganov",
        guestEmail: "timur.b@example.kz",
        guestCountry: "Казахстан",
        offsetFromToday: 3,
        nights: 1,
        adults: 2,
        children: 1,
        baseAmount: 35000,
      },
      {
        externalRoomTypeId: "kr-suit-c",
        guestName: "Asel Tulegenova",
        guestEmail: "asel.t@example.kz",
        guestCountry: "Казахстан",
        offsetFromToday: 8,
        nights: 3,
        adults: 2,
        children: 2,
        baseAmount: 62000,
      },
      {
        externalRoomTypeId: "kr-std-a",
        guestName: "Ermek Saduov",
        guestEmail: "ermek.s@example.kz",
        guestCountry: "Казахстан",
        offsetFromToday: 25,
        nights: 2,
        adults: 1,
        children: 0,
        baseAmount: 22000,
      },
    ],
  };
}
