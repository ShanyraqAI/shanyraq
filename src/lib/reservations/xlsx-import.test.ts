import assert from "node:assert/strict";
import test from "node:test";
import { Workbook } from "exceljs";
import { parseReservationWorkbook } from "./xlsx-import";

async function workbookBytes(configure: (workbook: Workbook) => void) {
  const workbook = new Workbook();
  configure(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("recognizes a chessboard with merged and repeated guest cells", async () => {
  const bytes = await workbookBytes(workbook => {
    const sheet = workbook.addWorksheet("Сентябрь 2026");
    sheet.addRow(["Номер", 1, 2, 3, 4]);
    sheet.addRow(["101", "Айбек", "", "", "Мария"]);
    sheet.mergeCells("B2:C2");
    sheet.addRow(["102", "", "Иван", "Иван", ""]);
  });
  const preview = await parseReservationWorkbook(bytes, "chess.xlsx", ["101", "102"]);
  assert.equal(preview.mode, "chessboard");
  assert.deepEqual(preview.rows.map(row => [row.guestName, row.roomNumber, row.checkIn, row.checkOut]), [
    ["Айбек", "101", "2026-09-01", "2026-09-03"],
    ["Мария", "101", "2026-09-04", "2026-09-05"],
    ["Иван", "102", "2026-09-02", "2026-09-04"],
  ]);
});

test("recognizes a row list and lets the caller choose a sheet", async () => {
  const bytes = await workbookBytes(workbook => {
    workbook.addWorksheet("Инструкция").addRow(["Пустой лист"]);
    const sheet = workbook.addWorksheet("Брони");
    sheet.addRow(["Номер", "Гость", "Заезд", "Выезд"]);
    sheet.addRow(["101", "Айбек", "10.09.2026", "12.09.2026"]);
  });
  const preview = await parseReservationWorkbook(bytes, "list.xlsx", ["101"], "Брони");
  assert.equal(preview.mode, "list");
  assert.deepEqual(preview.sheets, ["Инструкция", "Брони"]);
  assert.deepEqual(preview.rows[0], { sourceRow: 2, roomNumber: "101", guestName: "Айбек", checkIn: "2026-09-10", checkOut: "2026-09-12" });
});

test("marks unknown rooms and rejects corrupt or unrecognizable files", async () => {
  const bytes = await workbookBytes(workbook => {
    const sheet = workbook.addWorksheet("Октябрь 2026");
    sheet.addRow(["Номер", 1, 2]);
    sheet.addRow(["999", "Гость", ""]);
  });
  const preview = await parseReservationWorkbook(bytes, "unknown.xlsx", ["101"]);
  assert.match(preview.rows[0].warning ?? "", /Номер не найден/);
  await assert.rejects(parseReservationWorkbook(Buffer.from("not xlsx"), "bad.xlsx", []), { name: "PublicError" });
  const empty = await workbookBytes(workbook => workbook.addWorksheet("Пусто").addRow(["нет шахматки"]));
  await assert.rejects(parseReservationWorkbook(empty, "empty.xlsx", []), { name: "PublicError" });
});

test("accepts hotel files with a separate sheet for every month", async () => {
  const bytes = await workbookBytes(workbook => {
    for (let index = 1; index <= 24; index++) workbook.addWorksheet(`Архив ${index}`).addRow(["Нет броней"]);
    const sheet = workbook.addWorksheet("Сентябрь 2026");
    sheet.addRow(["Номер", 1, 2]);
    sheet.addRow(["101", "Айбек", "Айбек"]);
  });
  const preview = await parseReservationWorkbook(bytes, "calendar.xlsx", ["101"]);
  assert.equal(preview.sheets.length, 25);
  assert.equal(preview.rows[0].guestName, "Айбек");
});

test("reads rich text and formula results from third-party workbooks", async () => {
  const bytes = await workbookBytes(workbook => {
    const sheet = workbook.addWorksheet("Сентябрь 2026");
    sheet.addRow(["Номер", 1, 2]);
    sheet.getCell("A2").value = { richText: [{ text: "10" }, { text: "1" }] };
    sheet.getCell("B2").value = { formula: "\"Айбек\"", result: "Айбек" };
    sheet.getCell("C2").value = { formula: "\"Айбек\"", result: "Айбек" };
  });
  const preview = await parseReservationWorkbook(bytes, "third-party.xlsx", ["101"]);
  assert.deepEqual(preview.rows[0], {
    sourceRow: 2,
    roomNumber: "101",
    guestName: "Айбек",
    checkIn: "2026-09-01",
    checkOut: "2026-09-03",
  });
});

test("returns a safe actionable error when the workbook package is unreadable", async () => {
  const bytes = await workbookBytes(workbook => workbook.addWorksheet("Лист 1").addRow(["Номер", 1]));
  const broken = bytes.subarray(0, bytes.length - 30);
  await assert.rejects(
    parseReservationWorkbook(broken, "broken.xlsx", []),
    (error: unknown) => error instanceof Error
      && error.name === "PublicError"
      && /Пересохраните его в формате \.xlsx/.test(error.message),
  );
});
