import "server-only";

import { db } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { calculatePerformance, type ReportFilters } from "@/lib/reports/performance";
import { calculateOutstanding, summarizeOperations } from "@/lib/reports/finance";

export async function getHotelPerformanceReport(hotelId: string, filters: ReportFilters) {
  const [hotel, roomCount, reservations, sourceRows, commissionSettings] = await Promise.all([
    db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { currency: true } }),
    db.room.count({ where: { hotelId, status: { not: "OUT_OF_ORDER" } } }),
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
  ]);

  const scopedReservations = reservations.filter((row) => !filters.source || row.sourceChannel === filters.source);
  const financialReservations = scopedReservations.filter((row) => !["CANCELLED", "NO_SHOW"].includes(row.status));
  const commissionRows = scopedReservations.filter((row) => row.currency === hotel.currency && row.otaCommissionAmount !== null);
  const operations = scopedReservations.flatMap((row) => [
    ...row.financialOperations,
    ...(row.depositCollectedAt ? [{ amount: row.depositAmount, currency: row.currency, type: "PAYMENT", status: "COMPLETED" }] : []),
    ...(row.depositReturnedAt ? [{ amount: row.depositAmount, currency: row.currency, type: "REFUND", status: "COMPLETED" }] : []),
  ]).map((row) => ({ ...row, amount: Number(row.amount) }));
  const paymentSummary = summarizeOperations(operations, hotel.currency);
  const paymentCurrencies = [...new Set(operations.filter((row) => row.status === "COMPLETED" && ["PAYMENT", "REFUND"].includes(row.type)).map((row) => row.currency))];
  const serviceRows = scopedReservations.flatMap((row) => row.currency === hotel.currency && Array.isArray(row.financialServices) ? row.financialServices : [])
    .filter((service): service is { totalPrice: number } => Boolean(service) && typeof service === "object" && typeof (service as { totalPrice?: unknown }).totalPrice === "number");
  const knownBookingTotal = financialReservations.filter((row) => row.currency === hotel.currency && row.channelBookingAmount !== null)
    .reduce((sum, row) => sum + Number(row.channelBookingAmount), 0);
  const receivableRows = financialReservations.filter((row) => row.currency === hotel.currency && row.paymentCollect === "property" && row.channelBookingAmount !== null);
  const receivable = receivableRows.reduce((sum, row) => {
    const payments = row.financialOperations.filter((operation) => operation.type === "PAYMENT" && operation.status === "COMPLETED" && operation.currency === hotel.currency).reduce((total, operation) => total + Number(operation.amount), 0)
      + (row.depositCollectedAt ? Number(row.depositAmount) : 0);
    const refunds = row.financialOperations.filter((operation) => operation.type === "REFUND" && operation.status === "COMPLETED" && operation.currency === hotel.currency).reduce((total, operation) => total + Number(operation.amount), 0)
      + (row.depositReturnedAt ? Number(row.depositAmount) : 0);
    return sum + (calculateOutstanding({ amount: Number(row.channelBookingAmount), collected: payments, refunded: refunds, paymentCollect: row.paymentCollect, status: row.status }) ?? 0);
  }, 0);
  return {
    ...calculatePerformance(
      reservations.filter((reservation) => reservation.currency === hotel.currency).map((reservation) => ({ ...reservation, totalAmount: Number(reservation.totalAmount) })),
      roomCount,
      filters,
    ),
    sources: sourceRows.map((row) => row.sourceChannel),
    currency: hotel.currency,
    finance: {
      bookingAmount: knownBookingTotal,
      serviceAmount: serviceRows.reduce((sum, service) => sum + service.totalPrice, 0),
      serviceCount: serviceRows.length,
      commission: commissionRows.reduce((sum, row) => sum + Number(row.otaCommissionAmount), 0),
      commissionCount: commissionRows.length,
      estimatedCommissionCount: commissionRows.filter((row) => row.otaCommissionSource === "ESTIMATED").length,
      actualCommissionCount: commissionRows.filter((row) => row.otaCommissionSource === "CHANNEX").length,
      paid: paymentSummary.paid,
      refunded: paymentSummary.refunded,
      paymentsByCurrency: paymentCurrencies.map((currency) => ({ currency, ...summarizeOperations(operations, currency) })),
      expenses: paymentSummary.expenses,
      remaining: receivableRows.length ? receivable : null,
      receivableCount: receivableRows.length,
      currencies: [...new Set([...reservations.map((row) => row.currency), ...paymentSummary.currencies])],
    },
    commissionSettings: commissionSettings.map((row) => ({ sourceChannel: row.sourceChannel, ratePercent: Number(row.ratePercent), fixedFee: Number(row.fixedFee), currency: row.currency })),
    reservationOptions: scopedReservations.map((row) => ({ id: row.id, total: Number(row.channelBookingAmount ?? row.totalAmount), currency: row.currency })),
  };
}
