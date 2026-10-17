// Isolated server-component regression checks. No database or TTLock API calls.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const require = createRequire(import.meta.url);
const base = fileURLToPath(new URL("../src", import.meta.url));
function load(path, mocks) {
  const code = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id) => {
      if (id in mocks) return mocks[id];
      if (id === "react/jsx-runtime") return require(id);
      throw Error("Unmocked " + id);
    },
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}
const calls = [];
let denied = false,
  roomFound = true;
const hotel = { id: "hotel-a", timezone: "Asia/Almaty" };
const room = {
  id: "room-101",
  number: "101",
  floor: 1,
  status: "AVAILABLE",
  roomType: { name: "Стандарт", capacity: 2, basePrice: 25000 },
};
const db = {};
for (const model of [
  "tTLockConnection",
  "room",
  "reservation",
  "tTLockPasscode",
  "tTLockEvent",
])
  db[model] = {
    findMany: async (args) => {
      calls.push({ model, args });
      return [];
    },
    findUnique: async (args) => {
      calls.push({ model, args });
      return null;
    },
    findFirst: async (args) => {
      calls.push({ model, args });
      return roomFound ? room : null;
    },
  };
const common = {
  "next/link": { default: function Link() {} },
  "lucide-react": {
    KeyRound() {},
    LockKeyhole() {},
    Smartphone() {},
    ArrowLeft() {},
    CalendarDays() {},
  },
  "@/lib/db": { db },
  "@/lib/tenant": {
    getCurrentHotel: async () => hotel,
    getCurrentMembership: async () => ({
      hotelId: "hotel-a",
      userId: "user-a",
    }),
  },
  "@/lib/locale-server": { getRequestLocale: async () => "ru" },
  "@/components/ttlock/ttlock-manager": {
    TTLockManager: function Manager() {},
  },
  "@/lib/whatsapp": { whatsappHref: () => null },
  "@/server/guards": {
    requireSectionAccess: async (p) => {
      assert.equal(p, "ROOMS");
      if (denied) throw Error("DENIED");
    },
  },
  "@/lib/access": { hasHotelPermission: () => true },
  "@/server/actions/ttlock": { revokeTTLockPasscodeAction() {} },
  "next/navigation": {
    notFound: () => {
      throw Error("NOT_FOUND");
    },
  },
  "@/lib/utils": { formatMoney: (v) => String(v) },
  "@/lib/i18n": { t: { statuses: { room: { AVAILABLE: "Свободна" } } } },
  "@/components/ttlock/ttlock-workspace": {
    TTLockWorkspace: function Workspace() {},
  },
};
(async () => {
  const { TTLockWorkspace } = load(
    base + "/components/ttlock/ttlock-workspace.tsx",
    common,
  );
  await TTLockWorkspace({ roomId: "room-101" });
  assert.equal(calls.length, 5);
  for (const c of calls) assert.equal(c.args.where.hotelId, "hotel-a");
  assert.equal(calls.find((c) => c.model === "room").args.where.id, "room-101");
  assert.equal(
    calls.find((c) => c.model === "reservation").args.where.roomId,
    "room-101",
  );
  for (const m of ["tTLockPasscode", "tTLockEvent"])
    assert.deepEqual(calls.find((c) => c.model === m).args.where.lock, {
      roomId: "room-101",
      hotelId: "hotel-a",
    });
  calls.length = 0;
  await TTLockWorkspace({});
  for (const c of calls) assert.deepEqual(c.args.where.lock, undefined);
  calls.length = 0;
  denied = true;
  await assert.rejects(TTLockWorkspace({ roomId: "room-101" }), /DENIED/);
  assert.equal(calls.length, 0);
  denied = false;
  const { default: Profile } = load(
    base + "/app/dashboard/rooms/[roomId]/page.tsx",
    common,
  );
  const tree = await Profile({
    params: Promise.resolve({ roomId: "room-101" }),
  });
  assert.equal(calls[0].args.where.hotelId, "hotel-a");
  assert.equal(calls[0].args.where.id, "room-101");
  function elems(x) {
    if (!x || typeof x !== "object") return [];
    return [x, ...[x.props?.children].flat(Infinity).flatMap(elems)];
  }
  const all = elems(tree);
  assert(all.some((x) => x.props?.roomId === "room-101"));
  assert(
    all.some((x) => x.props?.href === "/dashboard/rooms/room-101/calendar"),
  );
  roomFound = false;
  await assert.rejects(
    Profile({ params: Promise.resolve({ roomId: "foreign-room" }) }),
    /NOT_FOUND/,
  );
  console.log(
    "PASS server: all 5 workspace queries tenant-scoped, 4 room-scoped, standalone retained, ROOMS guard, profile ownership, 404 for foreign/missing room, separate calendar link",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
