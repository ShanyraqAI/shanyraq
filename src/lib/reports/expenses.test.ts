import assert from "node:assert/strict";
import test from "node:test";
import { allocateExpense, expensesByCategory, expensesByRoom } from "./expenses";

test("expense is split equally between selected units", () => {
  const shares = allocateExpense({ amount: 1000, roomIds: ["a", "b"] }, ["a", "b", "c"]);
  assert.equal(shares.get("a"), 500);
  assert.equal(shares.get("b"), 500);
  assert.equal(shares.has("c"), false);
});

test("empty or stale selection is spread across all current units", () => {
  assert.equal(allocateExpense({ amount: 900, roomIds: [] }, ["a", "b", "c"]).get("c"), 300);
  assert.equal(allocateExpense({ amount: 900, roomIds: ["deleted"] }, ["a", "b", "c"]).get("a"), 300);
  assert.equal(allocateExpense({ amount: 900, roomIds: [] }, []).size, 0);
});

test("totals per unit and per category add up", () => {
  const list = [{ amount: 1000, roomIds: ["a", "b"], category: "Уборка" }, { amount: 600, roomIds: [], category: "Аренда" }, { amount: 400, roomIds: ["a"], category: "Уборка" }];
  const byRoom = expensesByRoom(list, ["a", "b"]);
  assert.equal((byRoom.get("a") ?? 0) + (byRoom.get("b") ?? 0), 2000);
  assert.deepEqual(expensesByCategory(list), [{ category: "Уборка", value: 1400 }, { category: "Аренда", value: 600 }]);
});
