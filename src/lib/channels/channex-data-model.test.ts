import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";

function model(name: string) {
  const value = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === name);
  assert.ok(value, `Prisma model ${name} must exist`);
  return value;
}

function hasUniqueIndex(name: string, fields: string[]) {
  return model(name).uniqueIndexes.some((index) => {
    return index.fields.length === fields.length && index.fields.every((field, position) => field === fields[position]);
  });
}

test("Channex revisions are idempotent inside a property", () => {
  assert.equal(hasUniqueIndex("ChannexBookingRevision", ["propertyRefId", "revisionId"]), true);
  assert.equal(hasUniqueIndex("ChannexBookingRevision", ["propertyRefId", "idempotencyKey"]), true);
});

test("Channex mappings carry property, hotel and organization tenant scope", () => {
  for (const name of ["ChannexRoomTypeMapping", "ChannexRatePlanMapping"]) {
    const propertyRelation = model(name).fields.find((field) => field.name === "property");
    assert.deepEqual(propertyRelation?.relationFromFields, ["propertyRefId", "rentalPropertyId", "hotelId", "organizationId"]);
  }
});

test("staging and production properties are isolated per rental property", () => {
  assert.equal(hasUniqueIndex("ChannexProperty", ["rentalPropertyId", "environment"]), true);
  assert.equal(hasUniqueIndex("ChannexProperty", ["hotelId", "environment"]), false);
  assert.equal(hasUniqueIndex("ChannexProperty", ["environment", "propertyId"]), true);
});

test("rate plans and Channex transport records cannot cross rental properties", () => {
  const ratePlanProperty = model("RatePlan").fields.find((field) => field.name === "rentalProperty");
  const bookingReservation = model("ChannexBooking").fields.find((field) => field.name === "reservation");
  assert.deepEqual(ratePlanProperty?.relationFromFields, ["rentalPropertyId", "hotelId"]);
  assert.deepEqual(bookingReservation?.relationFromFields, ["reservationId", "rentalPropertyId", "hotelId"]);
});

test("Channex ARI jobs and multi-room booking links preserve tenant scope", () => {
  const jobProperty = model("ChannexSyncJob").fields.find((field) => field.name === "property");
  const bookingLink = model("ChannexBookingReservation").fields.find((field) => field.name === "booking");
  const reservationLink = model("ChannexBookingReservation").fields.find((field) => field.name === "reservation");
  assert.deepEqual(jobProperty?.relationFromFields, ["propertyRefId", "rentalPropertyId", "hotelId", "organizationId"]);
  assert.deepEqual(bookingLink?.relationFromFields, ["bookingRecordId", "rentalPropertyId", "hotelId", "organizationId"]);
  assert.deepEqual(reservationLink?.relationFromFields, ["reservationId", "rentalPropertyId", "hotelId"]);
  assert.equal(hasUniqueIndex("ChannexBookingReservation", ["bookingRecordId", "roomKey"]), true);
});
