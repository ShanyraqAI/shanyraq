import { z } from "zod";

// ---------------------------------------------------------------------------
// Domain enums (string unions — portable across SQLite/PostgreSQL)
// ---------------------------------------------------------------------------

export const CHANNEL_CODES = ["booking", "ostrovok", "krisha", "direct"] as const;
export type ChannelCode = (typeof CHANNEL_CODES)[number];

export const RESERVATION_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "CHECKED_IN", "CHECKED_OUT", "NO_SHOW"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const ROOM_STATUSES = ["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE", "OUT_OF_ORDER"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const SYNC_STATUSES = ["RUNNING", "SUCCESS", "PARTIAL", "FAILED"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const CONNECTION_STATUSES = ["DISCONNECTED", "CONNECTED", "ERROR"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** Statuses that hold inventory. */
export const ACTIVE_RESERVATION_STATUSES: readonly ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN"];

// ---------------------------------------------------------------------------
// Channel display metadata
// ---------------------------------------------------------------------------

export const CHANNEL_META: Record<ChannelCode, { name: string; description: string; color: string }> = {
  booking: {
    name: "Booking.com",
    description: "Global OTA with the widest traveller reach.",
    color: "#003580",
  },
  ostrovok: {
    name: "Ostrovok",
    description: "OTA focused on CIS and Asian markets.",
    color: "#ff6d00",
  },
  krisha: {
    name: "Krisha",
    description: "Local Kazakhstan marketplace for stays.",
    color: "#0ea5e9",
  },
  direct: {
    name: "Direct",
    description: "Phone, walk-in and website bookings.",
    color: "#059669",
  },
};

// ---------------------------------------------------------------------------
// Zod schemas — shared by server actions
// ---------------------------------------------------------------------------

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in YYYY-MM-DD format");

export const createReservationSchema = z
  .object({
    guestId: z.string().optional(),
    guestName: z.string().trim().max(160).optional(),
    guestEmail: z.string().trim().email("Invalid email").or(z.literal("")).optional(),
    guestPhone: z.string().trim().max(40).optional(),
    roomId: z.string().min(1),
    checkIn: isoDate,
    checkOut: isoDate,
    adults: z.coerce.number().int().min(1).max(10),
    children: z.coerce.number().int().min(0).max(10).default(0),
    ratePlanId: z.string().min(1),
    sourceChannel: z.enum(CHANNEL_CODES).default("direct"),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => v.checkOut > v.checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  })
  .refine((v) => Boolean(v.guestId || v.guestName), {
    message: "Select an existing guest or enter a name",
    path: ["guestName"],
  });
export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const updateReservationSchema = z.object({
  id: z.string().min(1),
  guestId: z.string().min(1),
  roomId: z.string().min(1),
  checkIn: isoDate,
  checkOut: isoDate,
  adults: z.coerce.number().int().min(1).max(10),
  children: z.coerce.number().int().min(0).max(10).default(0),
  ratePlanId: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export const reservationStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(RESERVATION_STATUSES),
});

export const connectChannelSchema = z.object({
  channelId: z.enum(["booking", "ostrovok", "krisha"]),
  externalPropertyId: z.string().trim().min(1, "Property ID is required").max(64),
  username: z.string().trim().min(1, "Username is required").max(128),
  apiKey: z.string().trim().min(4, "API key must be at least 4 characters").max(256),
});
export type ConnectChannelInput = z.infer<typeof connectChannelSchema>;

export const saveRoomMappingsSchema = z.object({
  connectionId: z.string().min(1),
  mappings: z.array(
    z.object({
      roomTypeId: z.string().min(1),
      externalRoomTypeId: z.string().min(1),
      externalRoomName: z.string().min(1),
    }),
  ),
});

export const saveRateMappingsSchema = z.object({
  connectionId: z.string().min(1),
  mappings: z.array(
    z.object({
      ratePlanId: z.string().min(1),
      externalRateId: z.string().min(1),
      externalRateName: z.string().min(1),
    }),
  ),
});

export const roomStatusSchema = z.object({
  roomId: z.string().min(1),
  status: z.enum(ROOM_STATUSES),
});

export const hotelSettingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(240).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  timezone: z.string().trim().min(1).max(64),
  currency: z.enum(["KZT", "USD", "EUR"]),
});

export const bulkRateUpdateSchema = z
  .object({
    ratePlanId: z.string().min(1),
    from: isoDate,
    to: isoDate,
    price: z.coerce.number().positive().max(100_000_000),
    weekendsOnly: z.boolean().default(false),
  })
  .refine((v) => v.to >= v.from, {
    message: "End date must be on or after start date",
    path: ["to"],
  });

export const upsertGuestSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(1, "Name is required").max(160),
  email: z.string().trim().email("Invalid email").or(z.literal("")).optional(),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
