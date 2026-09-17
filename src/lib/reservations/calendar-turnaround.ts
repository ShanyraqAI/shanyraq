import { addDays, diffDays, parseISODate, toISODate } from "@/lib/dates";

export interface TimedCalendarStay {
  id: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
}

export interface QuickBookingSlot {
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  minutesAfterPrevious: number | null;
  minutesBeforeNext: number | null;
}

const DEFAULT_CHECK_IN_TIME = "14:00";
const DEFAULT_CHECK_OUT_TIME = "12:00";

function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function turnaroundMinutes(
  checkOutDate: string,
  checkOutTime: string,
  nextCheckInDate: string,
  nextCheckInTime: string,
): number {
  const dateMinutes = diffDays(parseISODate(checkOutDate), parseISODate(nextCheckInDate)) * 24 * 60;
  return dateMinutes + minutesOfDay(nextCheckInTime) - minutesOfDay(checkOutTime);
}

function hourWord(hours: number): string {
  const mod100 = hours % 100;
  const mod10 = hours % 10;
  if (mod100 >= 11 && mod100 <= 14) return "часов";
  if (mod10 === 1) return "час";
  if (mod10 >= 2 && mod10 <= 4) return "часа";
  return "часов";
}

export function formatTurnaroundDuration(totalMinutes: number): string {
  const absolute = Math.abs(totalMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  if (hours === 0) return `${minutes} мин.`;
  if (minutes === 0) return `${hours} ${hourWord(hours)}`;
  return `${hours} ${hourWord(hours)} ${minutes} мин.`;
}

export function turnaroundMessage(minutes: number): string {
  if (minutes < 0) return `⚠ Пересечение ${formatTurnaroundDuration(minutes)}`;
  if (minutes < 60) return `⚠ ${formatTurnaroundDuration(minutes)} на подготовку`;
  return `${formatTurnaroundDuration(minutes)} на подготовку`;
}

export function buildTurnaroundMap(stays: TimedCalendarStay[]): Map<string, number> {
  const byRoom = new Map<string, TimedCalendarStay[]>();
  for (const stay of stays) {
    const roomStays = byRoom.get(stay.roomId) ?? [];
    roomStays.push(stay);
    byRoom.set(stay.roomId, roomStays);
  }

  const result = new Map<string, number>();
  for (const roomStays of byRoom.values()) {
    roomStays.sort((a, b) => `${a.checkIn}T${a.checkInTime}`.localeCompare(`${b.checkIn}T${b.checkInTime}`));
    for (let index = 0; index < roomStays.length - 1; index++) {
      const current = roomStays[index];
      const next = roomStays[index + 1];
      if (current.checkOut !== next.checkIn) continue;
      result.set(current.id, turnaroundMinutes(current.checkOut, current.checkOutTime, next.checkIn, next.checkInTime));
    }
  }
  return result;
}

export function suggestQuickBookingSlot(
  stays: TimedCalendarStay[],
  roomId: string,
  checkIn: string,
): QuickBookingSlot | null {
  const roomStays = stays
    .filter((stay) => stay.roomId === roomId)
    .sort((a, b) => `${a.checkIn}T${a.checkInTime}`.localeCompare(`${b.checkIn}T${b.checkInTime}`));

  if (roomStays.some((stay) => stay.checkIn <= checkIn && stay.checkOut > checkIn)) return null;

  const previous = roomStays
    .filter((stay) => stay.checkOut <= checkIn)
    .sort((a, b) => `${b.checkOut}T${b.checkOutTime}`.localeCompare(`${a.checkOut}T${a.checkOutTime}`))[0];
  const next = roomStays.find((stay) => stay.checkIn > checkIn);
  const checkOut = next?.checkIn ?? toISODate(addDays(parseISODate(checkIn), 1));

  return {
    checkIn,
    checkOut,
    checkInTime: DEFAULT_CHECK_IN_TIME,
    checkOutTime: DEFAULT_CHECK_OUT_TIME,
    minutesAfterPrevious: previous?.checkOut === checkIn
      ? turnaroundMinutes(previous.checkOut, previous.checkOutTime, checkIn, DEFAULT_CHECK_IN_TIME)
      : null,
    minutesBeforeNext: next?.checkIn === checkOut
      ? turnaroundMinutes(checkOut, DEFAULT_CHECK_OUT_TIME, next.checkIn, next.checkInTime)
      : null,
  };
}
