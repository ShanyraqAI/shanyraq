export const EXPENSE_CATEGORIES = ["Коммунальные", "Уборка", "Ремонт", "Реклама", "Аренда", "Зарплата", "Расходники", "Прочее"] as const;

export type ExpenseRecord = { id: string; amount: number; category: string; roomIds: string[] };

/** Equal split between the selected units; unknown or empty selection falls back to every unit. */
export function allocateExpense(expense: { amount: number; roomIds: string[] }, allRoomIds: string[]): Map<string, number> {
  const known = new Set(allRoomIds);
  const targets = expense.roomIds.filter((id) => known.has(id));
  const shares = targets.length ? targets : allRoomIds;
  const result = new Map<string, number>();
  for (const id of shares) result.set(id, expense.amount / shares.length);
  return result;
}

export function expensesByRoom(expenses: Array<{ amount: number; roomIds: string[] }>, allRoomIds: string[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    for (const [roomId, share] of allocateExpense(expense, allRoomIds)) totals.set(roomId, (totals.get(roomId) ?? 0) + share);
  }
  return totals;
}

export function expensesByCategory(expenses: Array<{ amount: number; category: string }>) {
  const totals = new Map<string, number>();
  for (const expense of expenses) totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  return Array.from(totals, ([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value);
}
