import ExcelJS, { type Cell, type Worksheet } from "exceljs";
import { PublicError } from "@/server/errors";
import type { ReservationImportPreview, ReservationImportRow } from "./import-types";

const MAX_XLSX_BYTES = 5 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_ROWS = 2_000;
const MAX_COLUMNS = 400;
const RU_MONTHS = ["январ", "феврал", "март", "апрел", "май", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];

function validateZip(bytes: Buffer) {
  if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) throw new PublicError("Файл не является корректной книгой .xlsx");
  let entries = 0;
  let expanded = 0;
  for (let offset = 0; offset + 46 <= bytes.length; offset++) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) continue;
    entries++;
    if (bytes.readUInt16LE(offset + 8) & 1) throw new PublicError("Зашифрованные Excel-файлы не поддерживаются");
    expanded += bytes.readUInt32LE(offset + 24);
    if (entries > 2_000 || expanded > MAX_UNCOMPRESSED_BYTES) throw new PublicError("Excel-файл слишком большой после распаковки");
  }
  if (!entries) throw new PublicError("Структура Excel-файла повреждена");
}

function iso(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const value = date.toISOString().slice(0, 10);
  const expected = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  return value === expected ? value : null;
}

function addDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function cellText(cell: Cell): string {
  return cell.text.replace(/\s+/g, " ").trim();
}

function contextMonth(sheet: Worksheet): { year: number; month: number } | null {
  const title = sheet.name.toLowerCase();
  const titleMonth = /\bмая\b/u.test(title) ? 4 : RU_MONTHS.findIndex(name => title.includes(name));
  if (titleMonth >= 0) {
    return { year: Number(title.match(/20\d{2}/)?.[0] ?? new Date().getUTCFullYear()), month: titleMonth + 1 };
  }
  const sample: string[] = [];
  for (let row = 1; row <= Math.min(3, sheet.rowCount); row++) sample.push(sheet.getRow(row).values.toString());
  const text = sample.join(" ").toLowerCase();
  const year = Number(text.match(/20\d{2}/)?.[0] ?? new Date().getUTCFullYear());
  const month = /\bмая\b/u.test(text) ? 4 : RU_MONTHS.findIndex(name => text.includes(name));
  if (month >= 0) return { year, month: month + 1 };
  const numeric = text.match(/(?:^|\D)(0?[1-9]|1[0-2])[./-](20\d{2})(?:\D|$)/);
  return numeric ? { month: Number(numeric[1]), year: Number(numeric[2]) } : null;
}

function dateFromCell(cell: Cell, context: { year: number; month: number } | null): string | null {
  const value = cell.value;
  if (value instanceof Date) return iso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  if (typeof value === "number") {
    if (value > 1_000 && /[dmy]/i.test(cell.numFmt ?? "")) return new Date(Math.round((value - 25_569) * 86_400_000)).toISOString().slice(0, 10);
    if (Number.isInteger(value) && value >= 1 && value <= 31 && context) return iso(context.year, context.month, value);
  }
  const text = cellText(cell);
  let match = /^(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (match) return iso(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](20\d{2}))?$/.exec(text);
  if (match) return iso(Number(match[3] ?? context?.year ?? new Date().getUTCFullYear()), Number(match[2]), Number(match[1]));
  if (/^\d{1,2}$/.test(text) && context) return iso(context.year, context.month, Number(text));
  return null;
}

function guestFromCell(cell: Cell) {
  const raw = cell.text.trim();
  const phone = raw.match(/(?:\+?7|8)[\s()\d-]{8,}/)?.[0]?.trim();
  const guestName = raw.split(/[\r\n]/)[0].replace(phone ?? "", "").trim().slice(0, 160);
  return { guestName, ...(phone ? { guestPhone: phone.slice(0, 40) } : {}) };
}

function parseChessboard(sheet: Worksheet, knownRooms: Set<string>): Omit<ReservationImportPreview, "fileName" | "sheets"> | null {
  const context = contextMonth(sheet);
  let headerRow = 0;
  let dates: Array<{ col: number; value: string }> = [];
  for (let row = 1; row <= Math.min(30, sheet.rowCount); row++) {
    const found: Array<{ col: number; value: string }> = [];
    for (let col = 1; col <= Math.min(MAX_COLUMNS, sheet.columnCount); col++) {
      const value = dateFromCell(sheet.getCell(row, col), context);
      if (value) found.push({ col, value });
    }
    if (found.length >= 2 && found.length > dates.length) {
      headerRow = row;
      dates = found;
    }
  }
  if (!headerRow) return null;
  const dateStart = Math.min(...dates.map(date => date.col));
  const rows: ReservationImportRow[] = [];
  for (let row = headerRow + 1; row <= Math.min(MAX_ROWS, sheet.rowCount); row++) {
    let roomNumber = "";
    for (let col = 1; col < dateStart; col++) {
      const candidate = cellText(sheet.getCell(row, col));
      if (knownRooms.has(candidate)) {
        roomNumber = candidate;
        break;
      }
      if (!roomNumber && /^\p{L}?[\d-]{1,12}$/u.test(candidate)) roomNumber = candidate;
    }
    if (!roomNumber) continue;
    let active: ReservationImportRow | null = null;
    let previousDate = "";
    let previousText = "";
    for (const date of dates) {
      const cell = sheet.getCell(row, date.col);
      const text = cellText(cell);
      const contiguous = Boolean(previousDate) && addDay(previousDate) === date.value;
      if (!text) {
        active = null;
        previousText = "";
        previousDate = date.value;
        continue;
      }
      if (active && contiguous && text === previousText) {
        active.checkOut = addDay(date.value);
      } else {
        const guest = guestFromCell(cell);
        const warning = [
          !knownRooms.has(roomNumber) ? "Номер не найден" : "",
          /[/;&]/.test(guest.guestName) ? "Возможно, указано несколько гостей" : "",
        ].filter(Boolean).join(". ");
        active = { sourceRow: row, roomNumber, checkIn: date.value, checkOut: addDay(date.value), ...guest, ...(warning ? { warning } : {}) };
        if (active.guestName) rows.push(active);
      }
      previousText = text;
      previousDate = date.value;
    }
  }
  return { sheetName: sheet.name, mode: "chessboard", rows, warnings: context ? [] : ["Месяц не удалось определить из заголовка листа"] };
}

function normalizedHeader(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/g, "");
}

function parseList(sheet: Worksheet, knownRooms: Set<string>): Omit<ReservationImportPreview, "fileName" | "sheets"> | null {
  for (let row = 1; row <= Math.min(30, sheet.rowCount); row++) {
    const headers = new Map<string, number>();
    for (let col = 1; col <= Math.min(50, sheet.columnCount); col++) headers.set(normalizedHeader(cellText(sheet.getCell(row, col))), col);
    const find = (...names: string[]) => names.map(name => headers.get(name)).find(Boolean);
    const room = find("номер", "комната", "room");
    const guest = find("гость", "имя", "фио", "guest");
    const checkIn = find("заезд", "датазаезда", "checkin");
    const checkOut = find("выезд", "датавыезда", "checkout");
    if (!room || !guest || !checkIn || !checkOut) continue;
    const rows: ReservationImportRow[] = [];
    for (let sourceRow = row + 1; sourceRow <= Math.min(MAX_ROWS, sheet.rowCount); sourceRow++) {
      const roomNumber = cellText(sheet.getCell(sourceRow, room));
      const guestName = cellText(sheet.getCell(sourceRow, guest)).slice(0, 160);
      const from = dateFromCell(sheet.getCell(sourceRow, checkIn), null);
      const to = dateFromCell(sheet.getCell(sourceRow, checkOut), null);
      if (!roomNumber && !guestName) continue;
      const warning = [!knownRooms.has(roomNumber) ? "Номер не найден" : "", !from || !to ? "Проверьте даты" : ""].filter(Boolean).join(". ");
      rows.push({ sourceRow, roomNumber, guestName, checkIn: from ?? "", checkOut: to ?? "", ...(warning ? { warning } : {}) });
    }
    return { sheetName: sheet.name, mode: "list", rows, warnings: [] };
  }
  return null;
}

export async function parseReservationWorkbook(
  bytes: Buffer,
  fileName: string,
  knownRoomNumbers: string[],
  requestedSheet?: string,
): Promise<ReservationImportPreview> {
  if (!bytes.length || bytes.length > MAX_XLSX_BYTES) throw new PublicError("Размер Excel-файла не должен превышать 5 МБ");
  validateZip(bytes);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as never);
  if (!workbook.worksheets.length) throw new PublicError("В Excel-файле не найдено листов");
  if (workbook.worksheets.length > 100) throw new PublicError("В Excel-файле слишком много листов. Оставьте не более 100");
  const sheets = workbook.worksheets.map(sheet => sheet.name);
  const candidates = requestedSheet ? workbook.worksheets.filter(sheet => sheet.name === requestedSheet) : workbook.worksheets;
  if (!candidates.length) throw new PublicError("Выбранный лист не найден");
  const rooms = new Set(knownRoomNumbers.map(value => value.trim()));
  for (const sheet of candidates) {
    if (sheet.rowCount > MAX_ROWS || sheet.columnCount > MAX_COLUMNS) continue;
    const parsed = parseList(sheet, rooms) ?? parseChessboard(sheet, rooms);
    if (parsed?.rows.length) return { fileName: fileName.slice(0, 160), sheets, ...parsed };
  }
  throw new PublicError("Не удалось распознать список или шахматку. Проверьте заголовки дат и номера комнат");
}
