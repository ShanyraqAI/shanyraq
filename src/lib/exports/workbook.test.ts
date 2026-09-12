import assert from "node:assert/strict";
import test from "node:test";
import { Workbook } from "exceljs";
import { buildCsv, buildXlsx, type ExportDocument } from "./workbook";

const document: ExportDocument = {
  title: "Бронирования",
  subtitle: "Проверка",
  sheetName: "Бронирования",
  columns: [
    { header: "Гость", key: "guest", width: 24 },
    { header: "Заезд", key: "checkIn", width: 14, numberFormat: "dd.mm.yyyy" },
    { header: "Сумма", key: "amount", width: 14, numberFormat: "#,##0.00" },
  ],
  rows: [{ guest: "=2+2", checkIn: new Date("2026-09-11T00:00:00.000Z"), amount: 25_000 }],
};

test("xlsx export preserves typed values and readable worksheet settings", async () => {
  const bytes = await buildXlsx(document);
  const workbook = new Workbook();
  await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet("Бронирования");
  assert.ok(sheet);
  assert.equal(sheet.getCell("A2").value, "Бронирования");
  assert.equal(sheet.getCell("A5").value, "Гость");
  assert.equal(sheet.getCell("C6").value, 25_000);
  assert.equal(sheet.getCell("C6").numFmt, "#,##0.00");
  assert.equal(sheet.views[0]?.state, "frozen");
  assert.ok(sheet.autoFilter);
});

test("csv export includes UTF-8 BOM and neutralizes spreadsheet formulas", () => {
  const text = buildCsv(document).toString("utf8");
  assert.ok(text.startsWith("\uFEFF"));
  assert.match(text, /"'=2\+2"/);
  assert.match(text, /"25000"/);
});
