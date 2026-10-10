import { addDays, diffDays } from "@/lib/dates";
import { calculatePerformance, type ReportFilters } from "./performance";

export type UnitReservation = {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
  totalAmount: number;
  sourceChannel: string;
  currency: string;
  otaCommissionAmount: number | null;
};

export type UnitExpense = { roomId: string; amount: number; currency: string };

export type UnitFinanceRow = {
  roomId: string;
  number: string;
  revenue: number;
  expenses: number;
  commission: number;
  profit: number;
  occupancy: number;
  adr: number;
  revpar: number;
  occupiedNights: number;
};

/** Per-unit profit = revenue − channel commission − expenses, all counted only for nights inside the period. */
export function calculateUnitFinance(
  rooms: Array<{ id: string; number: string }>,
  reservations: UnitReservation[],
  expenses: UnitExpense[],
  currency: string,
  filters: ReportFilters,
): UnitFinanceRow[] {
  const toExclusive = addDays(filters.to, 1);
  const periodShare = (row: { checkIn: Date; checkOut: Date }) => {
    const nights = Math.max(1, diffDays(row.checkIn, row.checkOut));
    const start = row.checkIn > filters.from ? row.checkIn : filters.from;
    const end = row.checkOut < toExclusive ? row.checkOut : toExclusive;
    return Math.max(0, diffDays(start, end)) / nights;
  };
  return rooms.map((room) => {
    const own = reservations.filter((row) => row.roomId === room.id && row.currency === currency);
    const performance = calculatePerformance(own, 1, filters).summary;
    const commission = own
      .filter((row) => !["CANCELLED", "NO_SHOW"].includes(row.status) && (!filters.source || row.sourceChannel === filters.source) && row.otaCommissionAmount !== null)
      .reduce((sum, row) => sum + row.otaCommissionAmount! * periodShare(row), 0);
    const spent = expenses.filter((row) => row.roomId === room.id && row.currency === currency).reduce((sum, row) => sum + row.amount, 0);
    return {
      roomId: room.id,
      number: room.number,
      revenue: performance.revenue,
      expenses: spent,
      commission,
      profit: performance.revenue - commission - spent,
      occupancy: performance.occupancy,
      adr: performance.adr,
      revpar: performance.revpar,
      occupiedNights: performance.occupiedRoomNights,
    };
  });
}
