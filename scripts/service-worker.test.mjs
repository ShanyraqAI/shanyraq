import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
function worker(online = false) {
  const handlers = new Map(),
    stores = [],
    removed = [];
  const offline = { generic: true };
  const context = {
    URL,
    Response,
    Set,
    console,
    fetch: async () => {
      if (!online) throw new Error("network lost");
      return { status: 200, private: true };
    },
    caches: {
      keys: async () => [
        "shanyraq-pages-v1",
        "shanyraq-pages-v3",
        "shanyraq-static-v2",
      ],
      delete: async (k) => {
        removed.push(k);
        return true;
      },
      match: async (key) => {
        assert.equal(key, "/offline");
        return offline;
      },
      open: async (key) => ({
        put: async (...args) => stores.push({ key, args }),
        addAll: async () => {},
        keys: async () => [],
      }),
    },
    self: {
      location: { origin: "https://app.example" },
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: () => {},
      clients: { claim: async () => {} },
    },
  };
  vm.runInNewContext(
    readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
    context,
  );
  return { handlers, stores, removed, offline };
}
test("private navigations offline never retrieve a cached guest/hotel page", async () => {
  const w = worker();
  for (const path of [
    "/dashboard",
    "/dashboard/guests",
    "/dashboard/calendar?hotel=other",
  ]) {
    let response;
    w.handlers.get("fetch")({
      request: {
        method: "GET",
        mode: "navigate",
        url: `https://app.example${path}`,
      },
      respondWith: (value) => {
        response = value;
      },
    });
    assert.deepEqual(await response, w.offline);
  }
  assert.equal(w.stores.length, 0);
});
test("online private HTML is returned but never cached", async () => {
  const w = worker(true);
  let response;
  w.handlers.get("fetch")({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://app.example/dashboard/guests",
    },
    respondWith: (value) => {
      response = value;
    },
  });
  assert.equal((await response).private, true);
  assert.equal(w.stores.length, 0);
});
test("activation purges legacy authenticated page caches", async () => {
  const w = worker();
  let result;
  w.handlers.get("activate")({
    waitUntil: (value) => {
      result = value;
    },
  });
  await result;
  assert.ok(w.removed.includes("shanyraq-pages-v1"));
  assert.ok(w.removed.includes("shanyraq-pages-v3"));
});
test("old warm message cannot repopulate private pages", async () => {
  const w = worker(true);
  let result;
  w.handlers.get("message")({
    data: { type: "warm", urls: ["/dashboard/guests"] },
    waitUntil: (value) => {
      result = value;
    },
  });
  await result;
  assert.equal(w.stores.length, 0);
});
