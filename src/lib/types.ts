import type { ChannelCode, ReservationStatus, RoomStatus } from "@/lib/constants";
import type { ReservationWithRelations } from "@/lib/stats";

/**
 * Plain serializable view models passed from server components to client
 * components. Dates are ISO "YYYY-MM-DD" strings (hotel date-only semantics).
 */

export interface GuestVM {
  id: string;
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
  status: RoomStatus;
  roomTypeId: string;
  roomTypeName: string;
  guestTonight: string | null;
}

export interface RatePlanVM {
  id: string;
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
  adults: number;
  children: number;
  status: ReservationStatus;
  currency: string;
  totalAmount: number;
  channel: ChannelCode;
  externalReservationId: string | null;
  notes: string | null;
  createdAt: string; // full ISO instant
}

export function toReservationVM(r: ReservationWithRelations): ReservationVM {
  return {
    id: r.id,
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
    adults: r.adults,
    children: r.children,
    status: r.status as ReservationStatus,
    currency: r.currency,
    totalAmount: r.totalAmount,
    channel: r.sourceChannel as ChannelCode,
    externalReservationId: r.externalReservationId,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  };
}
