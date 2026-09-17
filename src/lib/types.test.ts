import assert from "node:assert/strict";
import test from "node:test";
import { guestDisplayId, ratePlanDisplayId, reservationDisplayId } from "./types";
import { officialDocumentNumber } from "./documents/numbers";

test("business entities use compact stable references", () => {
  assert.equal(reservationDisplayId(37), "B037");
  assert.equal(guestDisplayId(4), "G004");
  assert.equal(ratePlanDisplayId(1), "#001");
  assert.equal(reservationDisplayId(null), "B—");
});

test("legacy padded document numbers are displayed as official numbers", () => {
  assert.equal(officialDocumentNumber("0000000002"), "2");
  assert.equal(officialDocumentNumber("18"), "18");
  assert.equal(officialDocumentNumber("A-2"), "A-2");
});
