import type { Hotel, Prisma } from "@prisma/client";

type RentalPropertyClient = Pick<Prisma.TransactionClient, "rentalProperty">;
type LegacyHotelPropertyFields = Pick<
  Hotel,
  "id" | "orgId" | "name" | "propertyType" | "address" | "city" | "country" | "timezone" | "currency"
>;

function rentalPropertyDetailsFromHotel(hotel: LegacyHotelPropertyFields) {
  return {
    internalName: hotel.name,
    publicName: hotel.name,
    propertyType: hotel.propertyType,
    address: hotel.address,
    city: hotel.city,
    country: hotel.country,
    timezone: hotel.timezone,
    currency: hotel.currency,
  };
}

export async function createDefaultRentalProperty(
  client: RentalPropertyClient,
  hotel: LegacyHotelPropertyFields,
) {
  return client.rentalProperty.create({
    data: {
      organizationId: hotel.orgId,
      hotelId: hotel.id,
      ...rentalPropertyDetailsFromHotel(hotel),
      status: "ACTIVE",
      inventoryMode: "GROUPED_UNITS",
    },
    select: { id: true },
  });
}

export async function syncDefaultRentalProperty(
  client: RentalPropertyClient,
  hotel: LegacyHotelPropertyFields,
): Promise<void> {
  const property = await client.rentalProperty.findFirst({
    where: { hotelId: hotel.id, organizationId: hotel.orgId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (!property) throw new Error("Объект размещения для текущего workspace не найден");

  await client.rentalProperty.update({
    where: { id: property.id },
    data: rentalPropertyDetailsFromHotel(hotel),
  });
}
