/** Run only on an explicitly disposable PostgreSQL database. No .env is loaded. */
import assert from "node:assert/strict";
const url = process.env.COMMUNICATIONS_TEST_DATABASE_URL;
if (!url || process.env.COMMUNICATIONS_TEST_DISPOSABLE !== "1") throw new Error("Set COMMUNICATIONS_TEST_DATABASE_URL and COMMUNICATIONS_TEST_DISPOSABLE=1 for an isolated test database.");
const parsedUrl = new URL(url);
if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol) || !decodeURIComponent(parsedUrl.pathname).endsWith("_test")) throw new Error("The database name must end with _test. Never use a customer or production database.");
process.env.DATABASE_URL = url;
async function main() {
  const { db } = await import("../src/lib/db");
  const { getCommunicationWorkspace, getReservationCommunicationWorkspace, runCommunicationCommand } = await import("../src/lib/communications/service");
  const { profileSchema } = await import("../src/lib/communications/schema");
  const { requireSameOrigin } = await import("../src/lib/communications/http");
  const prefix = `comm-test-${crypto.randomUUID()}`;
  const ids = { org: `${prefix}-org`, hotel: `${prefix}-hotel`, property: `${prefix}-property`, type: `${prefix}-type`, room: `${prefix}-room`, guest: `${prefix}-guest`, user: `${prefix}-user`, reservation: `${prefix}-reservation` };
  const member = { id: `${prefix}-member`, role: "OWNER", organizationId: ids.org, hotelId: ids.hotel, userId: ids.user, accessLevel: "FULL", permissions: [] };
  try {
    await db.$transaction(async (tx) => {
      await tx.organization.create({ data: { id: ids.org, name: "Communication tests" } });
      await tx.user.create({ data: { id: ids.user, fullName: "Synthetic owner" } });
      await tx.hotel.create({ data: { id: ids.hotel, orgId: ids.org, slug: ids.hotel, name: "Test workspace" } });
      await tx.rentalProperty.create({ data: { id: ids.property, organizationId: ids.org, hotelId: ids.hotel, internalName: "Test", publicName: "Test", inventoryMode: "SINGLE_UNIT" } });
      await tx.roomType.create({ data: { id: ids.type, hotelId: ids.hotel, rentalPropertyId: ids.property, name: "Test", capacity: 2, basePrice: 10000 } });
      await tx.room.create({ data: { id: ids.room, hotelId: ids.hotel, rentalPropertyId: ids.property, roomTypeId: ids.type, number: "1" } });
      await tx.guest.create({ data: { id: ids.guest, hotelId: ids.hotel, fullName: "Synthetic Guest", phone: "77011234567" } });
      await tx.reservation.create({ data: { id: ids.reservation, hotelId: ids.hotel, rentalPropertyId: ids.property, guestId: ids.guest, roomId: ids.room, roomTypeId: ids.type, sourceChannel: "direct", checkIn: new Date("2026-10-14T00:00:00Z"), checkOut: new Date("2026-10-16T00:00:00Z"), totalAmount: 20000 } });
    });
    await assert.rejects(getReservationCommunicationWorkspace({ ...member, organizationId: `${prefix}-other` }, ids.reservation));
    await assert.rejects(runCommunicationCommand({ ...member, organizationId: `${prefix}-other` }, { action: "saveProfile", roomId: ids.room, version: 0, profile: profileSchema.parse({}) }));
    await runCommunicationCommand(member, { action: "saveProfile", roomId: ids.room, version: 0, profile: profileSchema.parse({ address: "Test address", wifiName: "Synthetic network" }) });
    await assert.rejects(runCommunicationCommand(member, { action: "saveProfile", roomId: ids.room, version: 0, profile: profileSchema.parse({}) }));
    const template = await runCommunicationCommand(member, { action: "saveTemplate", template: { version: 0, name: "Instruction", body: "Hello {{guest_name}}", language: "ru", status: "ACTIVE", isDefault: true, roomId: null } }) as { id: string };
    const key = crypto.randomUUID();
    const input = { action: "prepare" as const, reservationId: ids.reservation, body: "Hello Guest!", photoIds: [], templateId: template.id, requestKey: key };
    const draft = await runCommunicationCommand(member, input) as { id: string; text: string };
    const retry = await runCommunicationCommand(member, { ...input, body: "Changed retry" }) as { id: string; text: string };
    assert.equal(draft.id, retry.id); assert.equal(retry.text, "Hello Guest!");
    await runCommunicationCommand(member, { action: "saveTemplate", template: { id: template.id, version: 1, name: "Instruction", body: "New text", language: "ru", status: "ACTIVE", isDefault: true, roomId: null } });
    assert.equal((await db.guestCommunication.findUniqueOrThrow({ where: { id: draft.id } })).body, "Hello Guest!");
    assert.equal(await db.communicationTemplateVersion.count({ where: { templateId: template.id } }), 2);
    await assert.rejects(runCommunicationCommand(member, { ...input, body: "{{guest_name}}", requestKey: crypto.randomUUID() }));
    await assert.rejects(runCommunicationCommand(member, { ...input, photoIds: [`${prefix}-foreign-photo`], requestKey: crypto.randomUUID() }));
    await runCommunicationCommand(member, { action: "recordManual", messageId: draft.id, state: "MANUAL_WHATSAPP_OPENED" });
    const workspace = await getCommunicationWorkspace(member);
    assert.equal(workspace.rooms.length, 1); assert.equal(workspace.history.length, 1);
    assert.equal(workspace.history[0].state, "MANUAL_WHATSAPP_OPENED");
    assert.throws(() => requireSameOrigin(new Request("https://example.com/api/communications", { headers: { origin: "https://attacker.example" } })));
    console.log("PASS: tenant isolation, profile concurrency, template versions, immutable snapshots, idempotency, unresolved variables, foreign photos, manual statuses, CSRF.");
  } finally {
    // Only rows created by this invocation. Never reset, truncate, or delete other tenants.
    await db.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { hotelId: ids.hotel, actorUserId: ids.user } });
      await tx.guestCommunication.deleteMany({ where: { hotelId: ids.hotel } });
      await tx.communicationPhoto.deleteMany({ where: { hotelId: ids.hotel } });
      await tx.communicationProfile.deleteMany({ where: { hotelId: ids.hotel } });
      await tx.communicationTemplate.deleteMany({ where: { hotelId: ids.hotel } });
      await tx.reservation.deleteMany({ where: { id: ids.reservation } });
      await tx.room.deleteMany({ where: { id: ids.room } });
      await tx.roomType.deleteMany({ where: { id: ids.type } });
      await tx.guest.deleteMany({ where: { id: ids.guest } });
      await tx.rentalProperty.deleteMany({ where: { id: ids.property } });
      await tx.hotel.deleteMany({ where: { id: ids.hotel } });
      await tx.organization.deleteMany({ where: { id: ids.org } });
      await tx.user.deleteMany({ where: { id: ids.user } });
    });
    await db.$disconnect();
  }
}
void main().catch(() => { console.error("Communication tests failed. Database URL and sensitive data are not printed."); process.exitCode = 1; });
