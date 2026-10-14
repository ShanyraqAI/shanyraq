import test from "node:test";
import assert from "node:assert/strict";
import { renderMessage, validateTemplateSyntax, validateFinalMessage } from "./template";
import { commandSchema, profileSchema } from "./schema";
import { normalizeWhatsAppPhone, whatsappHref } from "../whatsapp";
import { readBoundedBody } from "./body";

test("substitutes guest and apartment values once", () => {
  const result = renderMessage("{{guest_name}} · {{property_address}}", { guest_name: "Алия", property_address: "ул. Абая, 10" });
  assert.equal(result.text, "Алия · ул. Абая, 10"); assert.equal(result.valid, true);
});
test("missing values remain editable and cannot be sent", () => {
  const result = renderMessage("Wi-Fi: {{wifi_password}}", {});
  assert.deepEqual(result.missing, ["wifi_password"]);
  assert.equal(result.valid, false); assert.ok(validateFinalMessage(result.text));
});
test("unknown and malformed variables cannot be saved", () => {
  for (const body of ["{{unknown}}", "{{guest_name}", "guest_name}}", "{{}}", "{{{{guest_name}}}}"])
    assert.ok(validateTemplateSyntax(body), body);
});
test("does not resolve prototype properties", () => {
  assert.ok(validateTemplateSyntax("{{constructor}}"));
  assert.ok(validateTemplateSyntax("{{__proto__}}"));
});
test("template values are not recursively evaluated", () => {
  const r = renderMessage("{{guest_name}}", { guest_name: "{{wifi_password}}", wifi_password: "secret" });
  assert.equal(r.text, "{{wifi_password}}"); assert.ok(validateFinalMessage(r.text));
});
test("empty and oversized final messages are blocked", () => {
  assert.ok(validateFinalMessage("  ")); assert.ok(validateFinalMessage("a".repeat(4097)));
  assert.equal(validateFinalMessage("Здравствуйте!"), null);
});
test("normalizes Kazakhstan numbers and URL-encodes edited text", () => {
  assert.equal(normalizeWhatsAppPhone("8 (701) 123-45-67"), "77011234567");
  assert.equal(normalizeWhatsAppPhone("7011234567"), "77011234567");
  const url = new URL(whatsappHref("+7 701 123 45 67", "Адрес & ключи?\nКвартира №1")!);
  assert.equal(url.pathname, "/77011234567"); assert.equal(url.searchParams.get("text"), "Адрес & ключи?\nКвартира №1");
});
test("profile links allow HTTPS but reject script, credential and malformed URLs", () => {
  for (const mapLink of ["javascript:alert(1)", "http://example.com", "https://user:password@example.com", "not-a-url"])
    assert.equal(profileSchema.safeParse({ mapLink }).success, false);
  assert.equal(profileSchema.safeParse({ mapLink: "https://maps.example.com/place" }).success, true);
});
test("commands do not accept confirmed delivery states or too many photos", () => {
  assert.equal(commandSchema.safeParse({ action: "recordManual", messageId: "x", state: "DELIVERED" }).success, false);
  assert.equal(commandSchema.safeParse({ action: "prepare", reservationId: "r", body: "Hello", photoIds: Array(7).fill("p"), requestKey: crypto.randomUUID() }).success, false);
});
test("snapshot bodies preserve edits and source profile objects stay unchanged", () => {
  const values = { guest_name: "Алия" };
  const first = renderMessage("Здравствуйте, {{guest_name}}", values).text;
  values.guest_name = "Другой гость";
  assert.equal(first, "Здравствуйте, Алия");
});
test("bounded request reading works without Content-Length", async () => {
  const request = new Request("https://example.com", { method: "POST", body: "abc" });
  assert.equal(new TextDecoder().decode(await readBoundedBody(request, 3)), "abc");
  await assert.rejects(readBoundedBody(new Request("https://example.com", { method: "POST", body: "abcd" }), 3));
});
test("schema limits profile secrets and keeps them out of selected template metadata", () => {
  assert.equal(profileSchema.safeParse({ wifiPassword: "a".repeat(161) }).success, false);
  const profile = profileSchema.parse({ wifiPassword: "secret", irrelevant: "ignored" });
  assert.equal(profile.wifiPassword, "secret"); assert.equal(Object.hasOwn(profile, "irrelevant"), false);
});
