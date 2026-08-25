import type { ChannelCode } from "@/lib/constants";

/**
 * Channel abstraction types.
 *
 * These structures are Shanyraq's canonical representation of the outside
 * world. External APIs have their own shapes — adapters translate them into
 * these types, never the other way around. The calendar, dashboard and core
 * services only ever see these interfaces.
 */

/** Credentials bundle for a channel connection. In production this lives behind an encrypted secret store. */
export interface ChannelCredentials {
  propertyId: string;
  username: string;
  apiKey: string;
}

/** Everything a provider needs to talk on behalf of a connection. */
export interface ChannelConnectionContext {
  connectionId: string;
  channelId: ChannelCode;
  hotelId: string;
  externalPropertyId: string | null;
  credentials: ChannelCredentials | null;
  /** Position in the provider's reservation feed — lets pulls be incremental. */
  importCursor: number;
}

export type ConnectionTestResult = { ok: true; message: string } | { ok: false; error: string };

/** A reservation as it arrives from an external channel, before normalization. */
export interface ExternalReservation {
  externalId: string;
  externalRoomTypeId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestCountry?: string;
  /** Hotel date-only strings: YYYY-MM-DD */
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  currency: string;
  totalAmount: number;
  status: "CONFIRMED" | "CANCELLED";
  notes?: string;
}

export interface ExternalRoomType {
  id: string;
  name: string;
  capacity: number;
}

export interface ExternalRatePlan {
  id: string;
  name: string;
  /** External room types this rate applies to. */
  appliesToRoomTypeIds: string[];
}

/** Room/rate catalogue used by the mapping UI after connecting a channel. */
export interface ExternalInventory {
  roomTypes: ExternalRoomType[];
  ratePlans: ExternalRatePlan[];
}

/** One day of sellable inventory for one external room type. */
export interface AvailabilityUpdate {
  externalRoomTypeId: string;
  /** YYYY-MM-DD */
  date: string;
  availableRooms: number;
  closed: boolean;
  minStay: number;
}

export interface RateUpdate {
  externalRateId: string;
  /** YYYY-MM-DD */
  date: string;
  price: number;
  currency: string;
}

export interface PullReservationsResult {
  reservations: ExternalReservation[];
  hasMore: boolean;
}

/**
 * The single contract every channel must implement — Booking.com, Ostrovok,
 * Krisha or any future OTA. Swapping a MockXProvider for a RealXProvider
 * touches nothing else in the codebase.
 */
export interface ChannelProvider {
  readonly code: ChannelCode;

  verifyCredentials(credentials: ChannelCredentials): Promise<ConnectionTestResult>;

  /** Catalogue of the channel's rooms/rates so the hotel can map them internally. */
  fetchExternalInventory(context: ChannelConnectionContext): Promise<ExternalInventory>;

  /** Incrementally download new/updated reservations since the last cursor. */
  pullReservations(context: ChannelConnectionContext): Promise<PullReservationsResult>;

  pushAvailability(context: ChannelConnectionContext, updates: AvailabilityUpdate[]): Promise<{ accepted: number }>;

  pushRates(context: ChannelConnectionContext, updates: RateUpdate[]): Promise<{ accepted: number }>;

  cancelExternalReservation(context: ChannelConnectionContext, externalReservationId: string): Promise<void>;
}
