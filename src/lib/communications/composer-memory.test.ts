import assert from "node:assert/strict";
import test from "node:test";
import { clearComposerMemory, recallComposer, rememberComposer } from "./composer-memory";
test("drafts are isolated by the full server-supplied scope", () => {
  clearComposerMemory();
  rememberComposer("u1:o1:h1:r1", { text: "Мой текст", templateId: "starter:0", photoIds: ["p1"] }, 1000);
  assert.equal(recallComposer("u2:o1:h1:r1", 1001), null);
  assert.equal(recallComposer("u1:o1:h2:r1", 1001), null);
  assert.equal(recallComposer("u1:o1:h1:r2", 1001), null);
  assert.equal(recallComposer("u1:o1:h1:r1", 1001)?.text, "Мой текст");
});
test("draft expires and clear removes all user data", () => {
  clearComposerMemory();
  rememberComposer("key", { text: "draft", templateId: "t", photoIds: [] }, 0);
  assert.equal(recallComposer("key", 15 * 60 * 1000), null);
  rememberComposer("key", { text: "draft", templateId: "t", photoIds: [] });
  clearComposerMemory(); assert.equal(recallComposer("key"), null);
});
test("callers cannot mutate saved photo arrays", () => {
  clearComposerMemory(); const photoIds = ["p1"];
  rememberComposer("key", { text: "draft", templateId: "t", photoIds });
  photoIds.push("other");
  assert.deepEqual(recallComposer("key")?.photoIds, ["p1"]);
});
