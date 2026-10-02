export type CommissionInput = {
  bookingAmount: number;
  channexCommission: number | null;
  ratePercent: number | null;
  fixedFee: number | null;
  currencyMatches: boolean;
};

export function calculateCommission(input: CommissionInput) {
  if (input.channexCommission !== null) {
    return { amount: input.channexCommission, source: "CHANNEX" as const };
  }
  if (input.ratePercent === null || input.fixedFee === null || !input.currencyMatches) {
    return { amount: null, source: null };
  }
  return {
    amount: Math.round((input.bookingAmount * input.ratePercent / 100 + input.fixedFee) * 100) / 100,
    source: "ESTIMATED" as const,
  };
}

export function summarizeOperations(operations: Array<{ amount: number; currency: string; type: string; status: string }>, currency: string) {
  const matching = operations.filter((operation) => operation.currency === currency && operation.status === "COMPLETED");
  const paid = matching.filter((operation) => operation.type === "PAYMENT").reduce((sum, row) => sum + row.amount, 0);
  const refunded = matching.filter((operation) => operation.type === "REFUND").reduce((sum, row) => sum + row.amount, 0);
  const expenses = matching.filter((operation) => operation.type === "EXPENSE").reduce((sum, row) => sum + row.amount, 0);
  return { paid, refunded, expenses, currencies: [...new Set(operations.map((row) => row.currency))] };
}

export function calculateOutstanding(input: { amount: number; collected: number; refunded: number; paymentCollect: string | null; status: string }) {
  if (input.paymentCollect !== "property" || ["CANCELLED", "NO_SHOW"].includes(input.status)) return null;
  return Math.max(0, input.amount - input.collected + input.refunded);
}

/** Legacy deposit marks count as cash movements on the day they happened, not on the stay dates. */
export function depositOperations(
  rows: Array<{ depositAmount: number; currency: string; depositCollectedAt: Date | null; depositReturnedAt: Date | null }>,
  from: Date,
  toExclusive: Date,
) {
  const inPeriod = (date: Date | null): date is Date => date !== null && date >= from && date < toExclusive;
  return rows.flatMap((row) => [
    ...(inPeriod(row.depositCollectedAt) ? [{ amount: row.depositAmount, currency: row.currency, type: "PAYMENT", status: "COMPLETED" }] : []),
    ...(inPeriod(row.depositReturnedAt) ? [{ amount: row.depositAmount, currency: row.currency, type: "REFUND", status: "COMPLETED" }] : []),
  ]);
}
