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
    description: "Глобальный канал с максимальным охватом путешественников.",
    color: "#003580",
  },
  ostrovok: {
    name: "Ostrovok",
    description: "Канал, ориентированный на рынки СНГ и Азии.",
    color: "#ff6d00",
  },
  krisha: {
    name: "Krisha",
    description: "Казахстанская площадка для размещения объектов проживания.",
    color: "#0ea5e9",
  },
  direct: {
    name: "Прямые брони",
    description: "Брони по телефону, на стойке и через сайт отеля.",
    color: "#059669",
  },
};

// ---------------------------------------------------------------------------
// Zod schemas — shared by server actions
// ---------------------------------------------------------------------------

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата должна быть в формате ГГГГ-ММ-ДД");

export const createReservationSchema = z
  .object({
    guestId: z.string().optional(),
    guestName: z.string().trim().max(160).optional(),
    guestEmail: z.string().trim().email("Некорректный email").or(z.literal("")).optional(),
    guestPhone: z.string().trim().max(40).optional(),
    roomId: z.string().min(1),
    checkIn: isoDate,
    checkOut: isoDate,
    adults: z.coerce.number().int().min(1).max(10),
    children: z.coerce.number().int().min(0).max(10).default(0),
    ratePlanId: z.string().min(1).optional(),
    sourceChannel: z.enum(CHANNEL_CODES).default("direct"),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => v.checkOut > v.checkIn, {
    message: "Дата выезда должна быть позже даты заезда",
    path: ["checkOut"],
  })
  .refine((v) => Boolean(v.guestId || v.guestName), {
    message: "Выберите гостя из списка или введите имя",
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
  externalPropertyId: z.string().trim().min(1, "Укажите ID объекта").max(64),
  username: z.string().trim().min(1, "Укажите имя пользователя").max(128),
  apiKey: z.string().trim().min(4, "API-ключ должен содержать минимум 4 символа").max(256),
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
    message: "Конечная дата не может быть раньше начальной",
    path: ["to"],
  });

export const upsertGuestSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(1, "Укажите имя").max(160),
  email: z.string().trim().email("Некорректный email").or(z.literal("")).optional(),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

/** Loose phone mask at input level; normalization happens server-side. */
export const PHONE_INPUT_REGEX = /^\+?\d[\d\s\-()]{6,18}$/;

/** Keeps digits and an optional leading "+" only — canonical storage format. */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Укажите имя и фамилию").max(160),
    method: z.enum(["email", "phone"]),
    email: z.string().trim().toLowerCase().email("Некорректный email").max(200).optional(),
    phone: z.string().trim().regex(PHONE_INPUT_REGEX, "Некорректный номер телефона").optional(),
    password: z.string().min(8, "Пароль должен содержать минимум 8 символов").max(64),
  })
  .refine((v) => (v.method === "email" ? Boolean(v.email) : Boolean(v.phone)), {
    message: "Заполните контактное поле",
    path: ["method"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Введите email или телефон").max(200),
  password: z.string().min(1, "Введите пароль").max(64),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Укажите имя и фамилию").max(160),
  avatarUrl: z
    .string()
    .trim()
    .url("Некорректная ссылка на изображение")
    .max(500)
    .or(z.literal(""))
    .optional(),
});

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Некорректные данные";
}
