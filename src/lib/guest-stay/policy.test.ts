import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  capability,
  unseal,
  seal,
  hash,
  checkoutPassed,
  range,
  listingInput,
  formInput,
  stayLink,
} from "./policy";
process.env.GUEST_STAY_SECRET = randomBytes(32).toString("hex");
process.env.APP_URL = "https://fixture.example";
test("random stable links are encrypted, hashed and kept in a URL fragment", () => {
  const a = capability(),
    b = capability();
  assert.notEqual(a.tokenHash, b.tokenHash);
  const clear = unseal(a.sealedToken);
  assert.match(clear, /^[a-f0-9]{64}$/);
  assert.equal(hash(clear), a.tokenHash);
  const u = new URL(stayLink(a.sealedToken));
  assert.equal(u.pathname, "/guest/stay");
  assert.equal(u.search, "");
  assert.equal(u.hash.slice(1), clear);
  assert(!a.sealedToken.includes(clear));
});
test("sealed token integrity rejects tampering", () => {
  const v = Buffer.from(seal("abc"), "base64");
  v[20] ^= 1;
  assert.throws(() => unseal(v.toString("base64")));
});
test("server key is mandatory and never has a built-in fallback", () => {
  const v = process.env.GUEST_STAY_SECRET;
  delete process.env.GUEST_STAY_SECRET;
  assert.throws(capability);
  process.env.GUEST_STAY_SECRET = v;
});
test("business dates validate leap days, order, length and guest count", () => {
  assert(
    range.safeParse({
      checkIn: "2028-02-29",
      checkOut: "2028-03-01",
      guests: 2,
    }).success,
  );
  for (const v of [
    { checkIn: "2026-02-29", checkOut: "2026-03-01" },
    { checkIn: "2026-10-20", checkOut: "2026-10-20" },
    { checkIn: "2026-10-20", checkOut: "2027-10-20" },
    { checkIn: "2026-10-20", checkOut: "2026-10-21", guests: 0 },
  ])
    assert(!range.safeParse(v).success);
});
test("checkout uses object timezone and time, not server midnight", () => {
  const day = new Date("2026-10-20Z");
  assert(
    !checkoutPassed(day, "12:00", "Asia/Almaty", new Date("2026-10-20T06:59Z")),
  );
  assert(
    checkoutPassed(day, "12:00", "Asia/Almaty", new Date("2026-10-20T07:00Z")),
  );
  assert(
    !checkoutPassed(
      day,
      "12:00",
      "America/New_York",
      new Date("2026-10-20T07:00Z"),
    ),
  );
});
test("public listing rejects unsafe schemes, credentials, private extra fields", () => {
  const l = {
    title: "Квартира",
    description: "",
    publicLocation: "Район",
    amenities: "",
    restrictions: "",
    contactUrl: "",
    photoIds: [],
    ratePlanId: null,
    published: false,
    publicContentConfirmed: true,
  };
  assert(listingInput.safeParse(l).success);
  for (const contactUrl of [
    "javascript:alert(1)",
    "data:text/html,x",
    "http://example.com",
    "https://user:pass@example.com",
  ])
    assert(!listingInput.safeParse({ ...l, contactUrl }).success);
  assert(!listingInput.safeParse({ ...l, wifiPassword: "secret" }).success);
  assert(
    !listingInput.safeParse({ ...l, publicContentConfirmed: false }).success,
  );
});
test("guest form is bounded, keeps Unicode names, does not accept trusted-record IDs", () => {
  const f = {
    firstName: "Әлия",
    lastName: "Ұзын-Аты",
    phone: "",
    arrivalTime: "23:59",
  };
  assert(formInput.safeParse(f).success);
  assert(!formInput.safeParse({ ...f, firstName: "a".repeat(81) }).success);
  assert(!formInput.safeParse({ ...f, arrivalTime: "24:00" }).success);
  assert(!formInput.safeParse({ ...f, guestId: "other" }).success);
});
