import assert from "node:assert/strict";
import { test } from "node:test";
import { getSyncIncidentId, syncFailureMessage } from "./sync-errors";

const incidentId = "a83e8fa1-ae0e-46be-b42b-a21cab78123b";

test("current and legacy safe errors preserve the incident code", () => {
  assert.equal(getSyncIncidentId(syncFailureMessage(incidentId)), incidentId);
  assert.equal(getSyncIncidentId(`Синхронизация не выполнена. Код ошибки: ${incidentId}`), incidentId);
});

test("stored internal errors and appended credentials never reach the public message", () => {
  for (const stored of [
    null, undefined, "", "PrismaClient error: password=secret",
    `Provider https://user:secret@example.com failed, request ${incidentId}`,
    `${syncFailureMessage(incidentId)} apiKey=secret`,
    `apiKey=secret ${syncFailureMessage(incidentId)}`,
    "Синхронизация не выполнена. Код инцидента: secret",
  ]) {
    assert.equal(getSyncIncidentId(stored), null);
    assert.equal(syncFailureMessage(getSyncIncidentId(stored)), syncFailureMessage(null));
    assert.doesNotMatch(syncFailureMessage(getSyncIncidentId(stored)), /secret|Prisma|Provider/);
  }
});
