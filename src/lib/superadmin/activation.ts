export interface ActivationUser {
  createdAt: Date;
  hasHotel: boolean;
  hasRoom: boolean;
  hasReservation: boolean;
  activityDates: Date[];
}

export interface ActivationFunnel {
  signup: number;
  hotel: number;
  room: number;
  firstReservation: number;
  returnedUser: number;
  activeSevenDays: number;
}

function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Centralised definitions so product can adjust the funnel without changing the UI. */
export function calculateActivationFunnel(
  users: ActivationUser[],
  now = new Date(),
): ActivationFunnel {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  return {
    signup: users.length,
    hotel: users.filter((user) => user.hasHotel).length,
    room: users.filter((user) => user.hasRoom).length,
    firstReservation: users.filter((user) => user.hasReservation).length,
    returnedUser: users.filter((user) =>
      user.activityDates.some((activity) => utcDay(activity) > utcDay(user.createdAt)),
    ).length,
    activeSevenDays: users.filter((user) =>
      user.activityDates.some((activity) => activity >= sevenDaysAgo && activity <= now),
    ).length,
  };
}

export function hotelActivationStatus(input: {
  roomCount: number;
  reservationCount: number;
  openedCalendar: boolean;
}): "Активирован" | "Первая бронь" | "Добавлены номера" | "Регистрация" {
  if (input.roomCount > 0 && input.reservationCount > 0 && input.openedCalendar) return "Активирован";
  if (input.reservationCount > 0) return "Первая бронь";
  if (input.roomCount > 0) return "Добавлены номера";
  return "Регистрация";
}
