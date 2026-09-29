import type { ChannelCode, ReservationStatus, RoomStatus } from "@/lib/constants";
import type { ReservationWithRelations } from "@/lib/stats";

/**
 * Plain serializable view models passed from server components to client
 * components. Dates are ISO "YYYY-MM-DD" strings (hotel date-only semantics).
 */

export interface GuestVM {
  id: string;
  sequenceNumber: number | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  notes: string | null;
}

export interface RoomTypeVM {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  basePrice: number;
}

export interface RoomVM {
  id: string;
  number: string;
  floor: number;
  sortOrder?: number;
  status: RoomStatus;
  roomTypeId: string;
  roomTypeName: string;
  capacity?: number;
  basePrice?: number;
  guestTonight: string | null;
}

export interface RatePlanVM {
  id: string;
  sequenceNumber: number | null;
  name: string;
  roomTypeId: string;
  roomTypeName: string;
  basePrice: number;
  currency: string;
  refundable: boolean;
  breakfastIncluded: boolean;
}

export interface ReservationVM {
  id: string;
  sequenceNumber: number | null;
  guestId: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  roomId: string;
  roomNumber: string;
  floor: number;
  roomTypeId: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  adults: number;
  children: number;
  ratePlanId: string | null;
  pricingMode: "RATE_PLAN" | "MANUAL";
  status: ReservationStatus;
  currency: string;
  totalAmount: number;
  depositAmount?: number;
  depositCollectedAt?: string | null;
  depositReturnedAt?: string | null;
  channel: ChannelCode;
  externalReservationId: string | null;
  notes: string | null;
  createdAt: string; // full ISO instant
  paymentMethod?: string | null;
}

export function toReservationVM(r: ReservationWithRelations): ReservationVM {
  return {
    id: r.id,
    sequenceNumber: r.sequenceNumber,
    guestId: r.guest.id,
    guestName: r.guest.fullName,
    guestEmail: r.guest.email,
    guestPhone: r.guest.phone,
    roomId: r.room.id,
    roomNumber: r.room.number,
    floor: r.room.floor,
    roomTypeId: r.roomType.id,
    roomTypeName: r.roomType.name,
    checkIn: r.checkIn.toISOString().slice(0, 10),
    checkOut: r.checkOut.toISOString().slice(0, 10),
    checkInTime: r.checkInTime,
    checkOutTime: r.checkOutTime,
    adults: r.adults,
    children: r.children,
    ratePlanId: r.ratePlanId,
    pricingMode: r.pricingMode as ReservationVM["pricingMode"],
    status: r.status as ReservationStatus,
    currency: r.currency,
    totalAmount: Number(r.totalAmount),
    depositAmount: Number(r.depositAmount ?? 0),
    depositCollectedAt: r.depositCollectedAt?.toISOString() ?? null,
    depositReturnedAt: r.depositReturnedAt?.toISOString() ?? null,
    channel: r.sourceChannel as ChannelCode,
    externalReservationId: r.externalReservationId,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    paymentMethod: r.paymentMethod ?? null,
  };
}

export function formatSequenceNumber(value: number | null | undefined): string {
  return value == null ? "—" : String(value).padStart(3, "0");
}

export function reservationDisplayId(value: number | null | undefined): string {
  return `B${formatSequenceNumber(value)}`;
}

export function guestDisplayId(value: number | null | undefined): string {
  return `G${formatSequenceNumber(value)}`;
}

export function ratePlanDisplayId(value: number | null | undefined): string {
  return `#${formatSequenceNumber(value)}`;
}
