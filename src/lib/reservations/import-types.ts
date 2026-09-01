export type ReservationImportRow = {
  sourceRow: number;
  guestName: string;
  guestPhone?: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  warning?: string;
};

export type ReservationImportPreview = {
  fileName: string;
  sheetName: string;
  sheets: string[];
  mode: "chessboard" | "list";
  rows: ReservationImportRow[];
  warnings: string[];
};

export type ReservationImportResult = {
  imported: number;
  errors: Array<{ sourceRow: number; message: string }>;
};
