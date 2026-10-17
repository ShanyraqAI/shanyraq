import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kaspiUrl,
  moneyCents,
  decimalMoney,
  paymentBalance,
  validatePaymentAmount,
  requestMessage,
} from "./policy";
import { paymentCommand } from "./schema";
test("ordinary outlet link is preserved, without invented invoice parameters", () => {
  assert.equal(
    kaspiUrl(" https://pay.kaspi.kz/pay/outlet_102 "),
    "https://pay.kaspi.kz/pay/outlet_102",
  );
});
test("reject spoofed, transformed, credentialed and parameterized URLs", () => {
  for (const url of [
    "http://pay.kaspi.kz/pay/x",
    "https://pay.kaspi.kz.evil.test/pay/x",
    "https://pay.kaspi.kz@evil.test/pay/x",
    "https://user@pay.kaspi.kz/pay/x",
    "https://pay.kaspi.kz:444/pay/x",
    "https://pay.kaspi.kz/pay/x?amount=500",
    "https://pay.kaspi.kz/pay/x#y",
    "https://pay.kaspi.kz/pay/%78",
    "https://pay.kaspi.kz/pay/x\\y",
    "javascript:alert(1)",
    "https://kaspi.kz/pay/x",
    "https://pay.kaspi.kz/pay/",
  ]) {
    assert.throws(() => kaspiUrl(url), url);
  }
});
test("money uses exact minor units and rejects rounding/overflow", () => {
  assert.equal(moneyCents("0.29"), 29);
  assert.equal(decimalMoney(moneyCents("999999999999.99")), "999999999999.99");
  for (const bad of ["1.001", "1e3", "-1", "NaN", "1000000000000", "1,20"]) {
    assert.throws(() => moneyCents(bad));
  }
});
test("balance includes refunds, not pending, expenses, other currencies or deposit", () => {
  const rows = [
    {
      amount: "30000.10",
      currency: "KZT",
      status: "COMPLETED",
      type: "PAYMENT",
    },
    { amount: "5000.05", currency: "KZT", status: "COMPLETED", type: "REFUND" },
    { amount: "10000", currency: "KZT", status: "PENDING", type: "PAYMENT" },
    { amount: "10000", currency: "USD", status: "COMPLETED", type: "PAYMENT" },
    { amount: "10000", currency: "KZT", status: "COMPLETED", type: "EXPENSE" },
  ];
  assert.deepEqual(paymentBalance("75000", rows, "KZT"), {
    paid: "30000.10",
    refunded: "5000.05",
    remaining: "49999.95",
  });
});
const input = {
  amount: "500",
  remaining: "1000",
  currency: "KZT",
  status: "CONFIRMED",
  paymentCollect: "property",
  collectionConfirmed: false,
};
test("valid partial amount normalized without rounding", () =>
  assert.equal(validatePaymentAmount(input), "500.00"));
test("block zero, overpayment, OTA, cancellation, non-KZT and unknown collector", () => {
  for (const change of [
    { amount: "0" },
    { amount: "1000.01" },
    { status: "CANCELLED" },
    { status: "NO_SHOW" },
    { currency: "USD" },
    { paymentCollect: "ota", collectionConfirmed: true },
    { paymentCollect: null },
  ])
    assert.throws(() => validatePaymentAmount({ ...input, ...change }));
  assert.equal(
    validatePaymentAmount({
      ...input,
      paymentCollect: null,
      collectionConfirmed: true,
    }),
    "500.00",
  );
});
test("overpayment clamps outstanding at zero", () =>
  assert.equal(
    paymentBalance(
      "100",
      [
        {
          amount: "200",
          currency: "KZT",
          type: "PAYMENT",
          status: "COMPLETED",
        },
      ],
      "KZT",
    ).remaining,
    "0.00",
  ));
test("prepared RU/KK messages state manual amount entry and exclude deposit", () => {
  for (const locale of ["ru", "kk"] as const) {
    const text = requestMessage({
      booking: "B102",
      amount: "500",
      recipient: "Тест",
      url: "https://pay.kaspi.kz/pay/x",
      locale,
      purpose: "PREPAYMENT",
    });
    assert.ok(text.includes("500.00 KZT"));
    assert.ok(text.includes("B102"));
    assert.ok(text.includes("https://pay.kaspi.kz/pay/x"));
    assert.ok(!text.includes("?amount="));
    assert.ok(!text.includes("\uFFFD"));
    assert.match(text, /депозит/);
  }
});
test("strict command schema disallows client assertions of paid/bank confirmed", () => {
  assert.equal(
    paymentCommand.safeParse({ action: "validate", id: "x", paid: true })
      .success,
    false,
  );
  assert.equal(
    paymentCommand.safeParse({
      action: "saveMethod",
      rentalPropertyId: "p",
      name: "X",
      recipient: "R",
      url: "url",
      enabled: true,
      version: -1,
    }).success,
    false,
  );
});

test("recipient cannot inject multiline or bidi payment instructions", () => {
  const c = {
    action: "saveMethod",
    rentalPropertyId: "p",
    name: "Kaspi",
    recipient: "R",
    url: "https://pay.kaspi.kz/pay/x",
    enabled: true,
    version: 0,
  };
  for (const recipient of ["R\nother link", "R\u202eevil", "R\u0000"])
    assert.equal(paymentCommand.safeParse({ ...c, recipient }).success, false);
});
