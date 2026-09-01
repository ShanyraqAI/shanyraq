import assert from "node:assert/strict";
import test from "node:test";
import { allowedGoogleSheetRedirect, googleSheetExportUrl } from "./google-sheets";

test("converts a public Google Sheets link to a constrained XLSX export", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz123456789";
  assert.equal(googleSheetExportUrl(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=42`).toString(),
    `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx&gid=42`);
});

test("rejects SSRF, credentials, lookalike hosts and untrusted redirects", () => {
  for (const value of [
    "http://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz",
    "https://docs.google.com.evil.example/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz",
    "https://user:secret@docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz",
    "https://127.0.0.1/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz",
  ]) assert.throws(() => googleSheetExportUrl(value), { name: "PublicError" });
  assert.equal(allowedGoogleSheetRedirect(new URL("https://doc-01-sheets.googleusercontent.com/export")), true);
  assert.equal(allowedGoogleSheetRedirect(new URL("https://googleusercontent.com.evil.example/export")), false);
  assert.equal(allowedGoogleSheetRedirect(new URL("http://doc-01-sheets.googleusercontent.com/export")), false);
});
