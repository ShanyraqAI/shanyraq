// Test process only: load server services outside the Next.js bundler.
// No auth/DB/business methods are mocked. Never import this from application code.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS preload must run before tsx/services.
const Module = require("node:module");
const original = Module._load;
Module._load = function (id, ...args) {
  if (id === "server-only") return {};
  return original.call(this, id, ...args);
};
