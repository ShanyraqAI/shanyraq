import type { ChannelCode } from "@/lib/constants";
import { BaseMockProvider, type MockProviderConfig } from "../mock/base-mock-provider";

/**
 * MockBookingProvider — simulates the Booking.com XML/API adapter.
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
        { id: "123451", name: "Standard Room", capacity: 2 },
        { id: "123456", name: "Deluxe Room", capacity: 3 },
        { id: "123789", name: "Suite", capacity: 4 },
      ],
      ratePlans: [
        { id: "99991", name: "Standard Flexible", appliesToRoomTypeIds: ["123451"] },
        { id: "99992", name: "Standard Non-refundable", appliesToRoomTypeIds: ["123451"] },
        { id: "99993", name: "Deluxe Flexible", appliesToRoomTypeIds: ["123456"] },
        { id: "99994", name: "Suite with Breakfast", appliesToRoomTypeIds: ["123789"] },
      ],
    },
    reservationTemplates: [
      {
        externalRoomTypeId: "123451",
        guestName: "Aigerim Serikbay",
        guestEmail: "aigerim.s@example.com",
        guestCountry: "Kazakhstan",
        offsetFromToday: 0,
        nights: 2,
        adults: 2,
        children: 0,
        baseAmount: 25000,
      },
      {
        externalRoomTypeId: "123456",
        guestName: "Viktor Petrov",
        guestEmail: "v.petrov@example.com",
        guestCountry: "Russia",
        offsetFromToday: 1,
        nights: 3,
        adults: 2,
        children: 1,
        baseAmount: 38000,
      },
      {
        externalRoomTypeId: "123451",
        guestName: "Emily Carter",
        guestEmail: "emily.carter@example.co.uk",
        guestCountry: "United Kingdom",
        offsetFromToday: 3,
        nights: 4,
        adults: 1,
        children: 0,
        baseAmount: 26000,
      },
      {
        externalRoomTypeId: "123789",
        guestName: "Daniyar Abenov",
        guestEmail: "d.abenov@example.kz",
        guestCountry: "Kazakhstan",
        offsetFromToday: 5,
        nights: 2,
        adults: 2,
        children: 2,
        baseAmount: 65000,
      },
      {
        externalRoomTypeId: "123456",
        guestName: "Marta Kowalska",
        guestEmail: "marta.k@example.pl",
        guestCountry: "Poland",
        offsetFromToday: 7,
        nights: 2,
        adults: 2,
        children: 0,
        baseAmount: 40000,
        cancelled: true, // exercises cancellation normalization on import
      },
      {
        externalRoomTypeId: "123451",
        guestName: "Chen Wei",
        guestEmail: "chen.wei@example.cn",
        guestCountry: "China",
        offsetFromToday: 10,
        nights: 3,
        adults: 2,
        children: 0,
        baseAmount: 27000,
      },
      {
        externalRoomTypeId: "123789",
        guestName: "Olzhas Nurpeisov",
        guestEmail: "olzhas.n@example.kz",
        guestCountry: "Kazakhstan",
        offsetFromToday: 14,
        nights: 1,
        adults: 2,
        children: 0,
        baseAmount: 70000,
      },
      {
        externalRoomTypeId: "123451",
        guestName: "Sofia Rossi",
        guestEmail: "sofia.rossi@example.it",
        guestCountry: "Italy",
        offsetFromToday: 18,
        nights: 5,
        adults: 2,
        children: 1,
        baseAmount: 25500,
      },
    ],
  };
}
