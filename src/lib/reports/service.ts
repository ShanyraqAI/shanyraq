import "server-only";

import { db } from "@/lib/db";
import { addDays, diffDays } from "@/lib/dates";
import { calculatePerformance, type ReportFilters } from "@/lib/reports/performance";
import { calculateUnitFinance } from "@/lib/reports/units";
import { expensesByRoom } from "@/lib/reports/expenses";
import { calculateOutstanding, depositOperations, summarizeOperations } from "@/lib/reports/finance";

export type GeneralExpense = { id: string; occurredAt: Date; amount: number; category: string; comment: string | null; roomIds: string[] };

/** Property-level expenses entered in the Expenses tab. A channel filter shows channel economics, so they are left out then. */
export async function getGeneralExpenses(hotelId: string, filters: ReportFilters): Promise<GeneralExpense[]> {
  if (filters.source) return [];
  const rows = await db.expense.findMany({
    where: { hotelId, occurredAt: { gte: filters.from, lt: addDays(filters.to, 1) } },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, occurredAt: true, amount: true, category: true, comment: true, roomIds: true },
  });
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

export async function getHotelPerformanceReport(hotelId: string, filters: ReportFilters, generalExpenses: GeneralExpense[] = []) {
  const toExclusive = addDays(filters.to, 1);
  const sourceFilter = filters.source ? { reservation: { sourceChannel: filters.source } } : {};
  const [hotel, roomCount, reservations, sourceRows, commissionSettings, periodExpenses, periodPayments, periodDeposits] = await Promise.all([
    db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { currency: true, incomeTaxRatePercent: true } }),
    db.room.count({ where: { hotelId, status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] } } }),
    db.reservation.findMany({
      where: {
        hotelId,
        checkIn: { lt: addDays(filters.to, 1) },
        checkOut: { gt: filters.from },
      },
      select: { id: true, checkIn: true, checkOut: true, status: true, totalAmount: true, sourceChannel: true,
        currency: true, channelBookingAmount: true, otaCommissionAmount: true, otaCommissionSource: true,
        paymentCollect: true, depositAmount: true, depositCollectedAt: true, depositReturnedAt: true,
        financialServices: true,
        financialOperations: { select: { amount: true, currency: true, type: true, status: true } } },
    }),
    db.reservation.findMany({
      where: { hotelId },
      distinct: ["sourceChannel"],
      orderBy: { sourceChannel: "asc" },
      select: { sourceChannel: true },
    }),
    db.channelCommissionSetting.findMany({ where: { hotelId }, orderBy: { sourceChannel: "asc" } }),
    db.financialOperation.findMany({ where: { hotelId, occurredAt: { gte: filters.from, lt: toExclusive }, type: "EXPENSE", status: "COMPLETED", ...sourceFilter }, select: { amount: true, currency: true } }),
    // Paid/refunded is cash flow: select by operation date, independent of the stay dates.
    db.financialOperation.findMany({ where: { hotelId, occurredAt: { gte: filters.from, lt: toExclusive }, type: { in: ["PAYMENT", "REFUND"] }, status: "COMPLETED", ...sourceFilter }, select: { amount: true, currency: true, type: true, status: true } }),
    db.reservation.findMany({
      where: {
        hotelId,
        ...(filters.source ? { sourceChannel: filters.source } : {}),
        OR: [{ depositCollectedAt: { gte: filters.from, lt: toExclusive } }, { depositReturnedAt: { gte: filters.from, lt: toExclusive } }],
      },
      select: { depositAmount: true, currency: true, depositCollectedAt: true, depositReturnedAt: true },
    }),
  ]);

  const scopedReservations = reservations.filter((row) => !filters.source || row.sourceChannel === filters.source);
  const financialReservations = scopedReservations.filter((row) => !["CANCELLED", "NO_SHOW"].includes(row.status));
  const commissionRows = financialReservations.filter((row) => row.currency === hotel.currency && row.otaCommissionAmount !== null);
  const operations = [
    ...periodPayments.map((row) => ({ ...row, amount: Number(row.amount) })),
    ...depositOperations(periodDeposits.map((row) => ({ ...row, depositAmount: Number(row.depositAmount) })), filters.from, toExclusive),
  ];
  const paymentSummary = summarizeOperations(operations, hotel.currency);
  const reservationExpenses = periodExpenses.filter((row) => row.currency === hotel.currency).reduce((sum, row) => sum + Number(row.amount), 0);
  const expenses = reservationExpenses + generalExpenses.reduce((sum, row) => sum + row.amount, 0);
  const performance = calculatePerformance(
    reservations.filter((reservation) => reservation.currency === hotel.currency).map((reservation) => ({ ...reservation, totalAmount: Number(reservation.totalAmount) })),
    roomCount,
    filters,
  );
  const missingCommissionCount = financialReservations.filter((row) => row.currency === hotel.currency && !["direct", "manual"].includes(row.sourceChannel.toLowerCase()) && row.otaCommissionAmount === null).length;
  const taxRatePercent = hotel.incomeTaxRatePercent === null ? null : Number(hotel.incomeTaxRatePercent);
  const taxEstimate = taxRatePercent === null ? null : performance.summary.revenue * taxRatePercent / 100;
  const periodShare = (row: { checkIn: Date; checkOut: Date }) => {
    const nights = Math.max(1, diffDays(row.checkIn, row.checkOut));
    const start = row.checkIn > filters.from ? row.checkIn : filters.from;
    const toExclusive = addDays(filters.to, 1);
    const end = row.checkOut < toExclusive ? row.checkOut : toExclusive;
    return Math.max(0, diffDays(start, end)) / nights;
  };
  const commissionAmount = commissionRows.reduce((sum, row) => sum + Number(row.otaCommissionAmount) * periodShare(row), 0);
  const netProfitBeforeTax = performance.summary.revenue - commissionAmount - expenses;
  const paymentCurrencies = [...new Set(operations.filter((row) => row.status === "COMPLETED" && ["PAYMENT", "REFUND"].includes(row.type)).map((row) => row.currency))];
  const serviceRows = scopedReservations.flatMap((row) => row.currency === hotel.currency && Array.isArray(row.financialServices) ? row.financialServices : [])
    .filter((service): service is { totalPrice: number } => Boolean(service) && typeof service === "object" && typeof (service as { totalPrice?: unknown }).totalPrice === "number");
  const knownBookingTotal = financialReservations.filter((row) => row.currency === hotel.currency && row.channelBookingAmount !== null)
    .reduce((sum, row) => sum + Number(row.channelBookingAmount) * periodShare(row), 0);
  const receivableRows = financialReservations.filter((row) => row.currency === hotel.currency && row.paymentCollect === "property" && row.channelBookingAmount !== null);
  const receivable = receivableRows.reduce((sum, row) => {
    const payments = row.financialOperations.filter((operation) => operation.type === "PAYMENT" && operation.status === "COMPLETED" && operation.currency === hotel.currency).reduce((total, operation) => total + Number(operation.amount), 0)
      + (row.depositCollectedAt ? Number(row.depositAmount) : 0);
    const refunds = row.financialOperations.filter((operation) => operation.type === "REFUND" && operation.status === "COMPLETED" && operation.currency === hotel.currency).reduce((total, operation) => total + Number(operation.amount), 0)
      + (row.depositReturnedAt ? Number(row.depositAmount) : 0);
    return sum + (calculateOutstanding({ amount: Number(row.channelBookingAmount), collected: payments, refunded: refunds, paymentCollect: row.paymentCollect, status: row.status }) ?? 0);
  }, 0);
  return {
    ...performance,
    sources: sourceRows.map((row) => row.sourceChannel),
    currency: hotel.currency,
    finance: {
      bookingAmount: knownBookingTotal,
      serviceAmount: serviceRows.reduce((sum, service) => sum + service.totalPrice, 0),
      serviceCount: serviceRows.length,
      commission: commissionAmount,
      commissionCount: commissionRows.length,
      estimatedCommissionCount: commissionRows.filter((row) => row.otaCommissionSource === "ESTIMATED").length,
      actualCommissionCount: commissionRows.filter((row) => row.otaCommissionSource === "CHANNEX").length,
      paid: paymentSummary.paid,
      refunded: paymentSummary.refunded,
      paymentsByCurrency: paymentCurrencies.map((currency) => ({ currency, ...summarizeOperations(operations, currency) })),
      expenses,
      netProfitBeforeTax,
      netProfitAfterTax: taxEstimate === null ? null : netProfitBeforeTax - taxEstimate,
      taxRatePercent,
      taxEstimate,
      missingCommissionCount,
      remaining: receivableRows.length ? receivable : null,
      receivableCount: receivableRows.length,
      currencies: [...new Set([...reservations.map((row) => row.currency), ...paymentSummary.currencies])],
    },
    commissionSettings: commissionSettings.map((row) => ({ sourceChannel: row.sourceChannel, ratePercent: Number(row.ratePercent), fixedFee: Number(row.fixedFee), currency: row.currency })),
    reservationOptions: scopedReservations.map((row) => ({ id: row.id, total: Number(row.channelBookingAmount ?? row.totalAmount), currency: row.currency })),
  };
}

export async function getUnitFinanceReport(hotelId: string, filters: ReportFilters, currency: string, generalExpenses: GeneralExpense[] = []) {
  const toExclusive = addDays(filters.to, 1);
  const sourceFilter = filters.source ? { sourceChannel: filters.source } : {};
  const [rooms, reservations, expenses] = await Promise.all([
    db.room.findMany({ where: { hotelId }, orderBy: [{ sortOrder: "asc" }, { number: "asc" }], select: { id: true, number: true } }),
    db.reservation.findMany({
      where: { hotelId, checkIn: { lt: toExclusive }, checkOut: { gt: filters.from }, ...sourceFilter },
      select: { roomId: true, checkIn: true, checkOut: true, status: true, totalAmount: true, sourceChannel: true, currency: true, otaCommissionAmount: true },
    }),
    db.financialOperation.findMany({
      where: { hotelId, type: "EXPENSE", status: "COMPLETED", occurredAt: { gte: filters.from, lt: toExclusive }, reservation: sourceFilter },
      select: { amount: true, currency: true, reservation: { select: { roomId: true } } },
    }),
  ]);
  const general = expensesByRoom(generalExpenses, rooms.map((room) => room.id));
  const rows = calculateUnitFinance(
    rooms,
    reservations.map((row) => ({ ...row, totalAmount: Number(row.totalAmount), otaCommissionAmount: row.otaCommissionAmount === null ? null : Number(row.otaCommissionAmount) })),
    expenses.map((row) => ({ roomId: row.reservation.roomId, amount: Number(row.amount), currency: row.currency })),
    currency,
    filters,
  );
  return rows.map((row) => {
    const extra = general.get(row.roomId) ?? 0;
    return { ...row, expenses: row.expenses + extra, profit: row.profit - extra };
  });
}
