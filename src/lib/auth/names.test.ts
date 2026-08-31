import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { fullNameFromParts, resolveUserName, userNameFields } from "./names";

const schema = z.object(userNameFields);

test("legacy accounts greet by the first word without changing the stored name", () => {
  assert.deepEqual(resolveUserName({ fullName: "  Иманали   Сагимбаев  " }), {
    firstName: "Иманали", lastName: "Сагимбаев",
  });
});

test("explicit compound first and last names survive profile round trips", () => {
  const name = schema.parse({ firstName: "  Анна Мария  ", lastName: "де ла Крус" });
  assert.deepEqual(resolveUserName({ ...name, fullName: fullNameFromParts(name) }), {
    firstName: "Анна Мария", lastName: "де ла Крус",
  });
});

test("a deliberately empty surname is not replaced with legacy words", () => {
  assert.deepEqual(resolveUserName({ firstName: "Анна Мария", lastName: "", fullName: "Анна Мария" }), {
    firstName: "Анна Мария", lastName: "",
  });
});

test("server validation rejects blank, oversized and control-character names", () => {
  for (const firstName of ["   ", "а".repeat(81), "Имя\u0000"]) {
    assert.equal(schema.safeParse({ firstName, lastName: "Фамилия" }).success, false);
  }
  assert.equal(schema.safeParse({ firstName: "Имя", lastName: "я".repeat(81) }).success, false);
});

test("single names remain valid without inventing a surname", () => {
  const name = schema.parse({ firstName: "Ли" });
  assert.equal(fullNameFromParts(name), "Ли");
  assert.equal(resolveUserName({ fullName: "Ли" }).lastName, "");
});
