import test from "node:test";
import assert from "node:assert/strict";
import { pageNumber, guestPageUrl } from "./pagination";
test("pagination rejects malformed and caps unbounded values", () => {
  for (const v of [undefined, [], "x", "-1", "1.5", "10000000"])
    assert.equal(pageNumber(v), 1);
  assert.equal(pageNumber("0"), 1);
  assert.equal(pageNumber("999999"), 10000);
});
test("detail pagination preserves search, selection and active notes tab", () => {
  const url = new URL(
    guestPageUrl({
      page: 2,
      q: "Алия + имя",
      guest: "id",
      notes: 3,
      tab: "notes",
    }),
    "https://example.invalid",
  );
  assert.equal(url.searchParams.get("q"), "Алия + имя");
  assert.equal(url.searchParams.get("tab"), "notes");
  assert.equal(url.searchParams.get("guest"), "id");
});
