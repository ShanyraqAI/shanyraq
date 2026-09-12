import { Workbook, type Alignment, type Fill, type Font } from "exceljs";

export type ExportCell = string | number | Date | null;

export interface ExportColumn {
  header: string;
  key: string;
  width: number;
  numberFormat?: string;
}

export interface ExportDocument {
  title: string;
  subtitle: string;
  sheetName: string;
  columns: ExportColumn[];
  rows: Record<string, ExportCell>[];
}

const DARK_GREEN = "1F4D3A";
const LIGHT_GREEN = "EAF3EF";
const WHITE = "FFFFFF";
const BODY_FONT: Partial<Font> = { name: "Aptos", size: 10, color: { argb: "24332D" } };
const HEADER_FILL: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_GREEN } };
const CENTER: Partial<Alignment> = { vertical: "middle", horizontal: "center" };

export async function buildXlsx(document: ExportDocument): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = "Shanyraq";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(document.sheetName.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  worksheet.mergeCells(2, 1, 2, Math.max(1, document.columns.length));
  const titleCell = worksheet.getCell(2, 1);
  titleCell.value = document.title;
  titleCell.font = { name: "Aptos Display", size: 16, bold: true, color: { argb: DARK_GREEN } };

  worksheet.mergeCells(3, 1, 3, Math.max(1, document.columns.length));
  const subtitleCell = worksheet.getCell(3, 1);
  subtitleCell.value = document.subtitle;
  subtitleCell.font = { ...BODY_FONT, italic: true, color: { argb: "60736B" } };

  const headerRow = worksheet.getRow(5);
  document.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = HEADER_FILL;
    cell.alignment = CENTER;
    cell.border = { bottom: { style: "thin", color: { argb: "16382A" } } };
    worksheet.getColumn(index + 1).width = column.width;
  });
  headerRow.height = 24;

  document.rows.forEach((record, rowIndex) => {
    const row = worksheet.getRow(rowIndex + 6);
    document.columns.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = record[column.key] ?? "";
      cell.font = BODY_FONT;
      cell.alignment = { vertical: "middle", wrapText: true };
      if (column.numberFormat && (typeof cell.value === "number" || cell.value instanceof Date)) {
        cell.numFmt = column.numberFormat;
      }
      if (rowIndex % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GREEN } };
      }
      cell.border = { bottom: { style: "hair", color: { argb: "D5E0DB" } } };
    });
    row.height = 21;
  });

  const lastRow = Math.max(5, document.rows.length + 5);
  worksheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: lastRow, column: document.columns.length } };
  worksheet.pageSetup.printTitlesRow = "5:5";
  worksheet.headerFooter.oddFooter = "Shanyraq · &D · стр. &P из &N";

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function safeCsvValue(value: ExportCell): string {
  let text = value instanceof Date ? value.toISOString().slice(0, 10) : value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text.trimStart())) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildCsv(document: ExportDocument): Buffer {
  const rows = [
    document.columns.map((column) => safeCsvValue(column.header)).join(";"),
    ...document.rows.map((record) => document.columns.map((column) => safeCsvValue(record[column.key] ?? null)).join(";")),
  ];
  return Buffer.from(`\uFEFF${rows.join("\r\n")}\r\n`, "utf8");
}
