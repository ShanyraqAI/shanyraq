import type { ChannelCode } from "@/lib/constants";
import { BaseMockProvider, type MockProviderConfig } from "../mock/base-mock-provider";

/**
 * MockBookingProvider вЂ” simulates the Booking.com XML/API adapter.
 *
 * External room/rate ids mimic Booking.com's numeric id style. When official
 * credentials become available, implement `RealBookingProvider` with the same
 * interface and register it in provider-registry.ts.
 */
export class MockBookingProvider extends BaseMockProvider {
  readonly code: ChannelCode = "booking";

  protected config: MockProviderConfig = {
    code: "booking",
    label: "Booking.com",
    batchLimit: 2,
    inventory: {
      roomTypes: [
        { id: "123451", name: "РЎС‚Р°РЅРґР°СЂС‚РЅС‹Р№ РЅРѕРјРµСЂ", capacity: 2 },
        { id: "123456", name: "РЈР»СѓС‡С€РµРЅРЅС‹Р№ РЅРѕРјРµСЂ", capacity: 3 },
        { id: "123789", name: "Р›СЋРєСЃ", capacity: 4 },
      ],
      ratePlans: [
        { id: "99991", name: "Р“РёР±РєРёР№ С‚Р°СЂРёС„ В«РЎС‚Р°РЅРґР°СЂС‚В»", appliesToRoomTypeIds: ["123451"] },
        { id: "99992", name: "РќРµРІРѕР·РІСЂР°С‚РЅС‹Р№ С‚Р°СЂРёС„ В«РЎС‚Р°РЅРґР°СЂС‚В»", appliesToRoomTypeIds: ["123451"] },
        { id: "99993", name: "Р“РёР±РєРёР№ С‚Р°СЂРёС„ В«Р”РµР»СЋРєСЃВ»", appliesToRoomTypeIds: ["123456"] },
        { id: "99994", name: "Р›СЋРєСЃ СЃ Р·Р°РІС‚СЂР°РєРѕРј", appliesToRoomTypeIds: ["123789"] },
      ],
    },
    reservationTemplates: [
      {
        externalRoomTypeId: "123789",
        guestName: "Daniyar Abenov",
        guestEmail: "d.abenov@example.kz",
        guestCountry: "Казахстан",
        offsetFromToday: 4,
        nights: 2,
        adults: 2,
        children: 2,
        baseAmount: 65000,
      },
      {
        externalRoomTypeId: "123456",
        guestName: "Marta Kowalska",
        guestEmail: "marta.k@example.pl",
        guestCountry: "Польша",
        offsetFromToday: 4,
        nights: 2,
        adults: 2,
        children: 0,
        baseAmount: 40000,
      },
      {
        externalRoomTypeId: "123451",
        guestName: "Emily Carter",
        guestEmail: "emily.carter@example.co.uk",
        guestCountry: "Великобритания",
        offsetFromToday: 6,
        nights: 2,
        adults: 1,
        children: 0,
        baseAmount: 26000,
      },
      {
        externalRoomTypeId: "123456",
        guestName: "Chen Wei",
        guestEmail: "chen.wei@example.cn",
        guestCountry: "Китай",
        offsetFromToday: 6,
        nights: 3,
        adults: 2,
        children: 0,
        baseAmount: 38000,
        cancelled: true, // exercises cancellation normalization on import
      },
      {
        externalRoomTypeId: "123789",
        guestName: "Olzhas Nurpeisov",
        guestEmail: "olzhas.n@example.kz",
        guestCountry: "Казахстан",
        offsetFromToday: 12,
        nights: 1,
        adults: 2,
        children: 0,
        baseAmount: 70000,
      },
      {
        externalRoomTypeId: "123451",
        guestName: "Aigerim Serikbay",
        guestEmail: "aigerim.s@example.com",
        guestCountry: "Казахстан",
        offsetFromToday: 13,
        nights: 2,
        adults: 2,
        children: 0,
        baseAmount: 25000,
      },
      {
        externalRoomTypeId: "123789",
        guestName: "Zhang Lei",
        guestEmail: "zhang.lei@example.cn",
        guestCountry: "Китай",
        offsetFromToday: 15,
        nights: 1,
        adults: 2,
        children: 0,
        baseAmount: 71000,
      },
    ],
  };
}
