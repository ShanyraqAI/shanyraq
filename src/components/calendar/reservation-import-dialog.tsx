"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Link2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { confirmReservationImportAction, previewReservationImportAction } from "@/server/actions/reservations";
import type { ReservationImportPreview, ReservationImportResult, ReservationImportRow } from "@/lib/reservations/import-types";

export function ReservationImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"file" | "google">("file");
  const [file, setFile] = useState<File | null>(null);
  const [googleUrl, setGoogleUrl] = useState("");
  const [preview, setPreview] = useState<ReservationImportPreview | null>(null);
  const [rows, setRows] = useState<ReservationImportRow[]>([]);
  const [result, setResult] = useState<ReservationImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setPreview(null);
    setRows([]);
    setResult(null);
  }

  function buildFormData(sheetName?: string) {
    const data = new FormData();
    data.set("source", source);
    if (source === "file" && file) data.set("file", file);
    if (source === "google") data.set("googleUrl", googleUrl);
    if (sheetName) data.set("sheetName", sheetName);
    return data;
  }

  function parse(sheetName?: string) {
    if (source === "file" && !file) return toast.error("Выберите файл .xlsx");
    if (source === "google" && !googleUrl.trim()) return toast.error("Вставьте публичную ссылку Google Sheets");
    startTransition(async () => {
      try {
        const response = await previewReservationImportAction(buildFormData(sheetName));
        if (!response.ok || !response.data) {
          toast.error(response.error);
          return;
        }
        setPreview(response.data);
        setRows(response.data.rows.slice(0, 100));
        setResult(null);
        if (response.data.rows.length > 100) toast.warning("Показаны первые 100 броней. Разделите файл на несколько импортов.");
      } catch {
        toast.error("Не удалось прочитать таблицу. Проверьте соединение и попробуйте снова.");
      }
    });
  }

  function update(index: number, patch: Partial<ReservationImportRow>) {
    setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch, warning: undefined } : row));
  }

  function confirm() {
    startTransition(async () => {
      try {
        const response = await confirmReservationImportAction(rows);
        if (!response.ok || !response.data) {
          toast.error(response.error);
          return;
        }
        setResult(response.data);
        setPreview(null);
        setRows([]);
        toast[response.data.errors.length ? "warning" : "success"](response.message);
        router.refresh();
        if (!response.data.errors.length) setOpen(false);
      } catch {
        toast.error("Импорт прерван. Обновите календарь перед повторной попыткой.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><FileSpreadsheet className="size-4" /> Импорт Excel</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Импорт бронирований</DialogTitle>
          <DialogDescription>Сначала проверьте распознанные строки. До подтверждения календарь не изменяется.</DialogDescription>
        </DialogHeader>

        {!preview && !result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={source === "file" ? "default" : "outline"} onClick={() => { setSource("file"); reset(); }}><Upload className="size-4" /> Файл .xlsx</Button>
              <Button type="button" variant={source === "google" ? "default" : "outline"} onClick={() => { setSource("google"); reset(); }}><Link2 className="size-4" /> Google Sheets</Button>
            </div>
            {source === "file" ? (
              <div className="space-y-2">
                <Label htmlFor="reservation-import-file">Excel-файл до 3 МБ</Label>
                <Input id="reservation-import-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={event => { const selected = event.target.files?.[0] ?? null; if (selected && selected.size > 3 * 1024 * 1024) { toast.error("Файл превышает 3 МБ"); event.target.value = ""; setFile(null); } else setFile(selected); }} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="reservation-import-url">Публичная ссылка Google Sheets</Label>
                <Input id="reservation-import-url" type="url" placeholder="https://docs.google.com/spreadsheets/d/…" value={googleUrl} onChange={event => setGoogleUrl(event.target.value)} />
                <p className="text-xs text-muted-foreground">В Google Sheets включите доступ «Все, у кого есть ссылка — читатель».</p>
              </div>
            )}
            <Button type="button" onClick={() => parse()} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />} Распознать таблицу
            </Button>
          </div>
        ) : null}

        {preview ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-secondary/30 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{preview.fileName}</p>
                <p className="text-xs text-muted-foreground">{preview.mode === "chessboard" ? "Распознана шахматка" : "Распознан список"} · {rows.length} броней</p>
              </div>
              <Select value={preview.sheetName} onValueChange={parse} disabled={pending}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>{preview.sheets.map(sheet => <SelectItem key={sheet} value={sheet}>{sheet}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {preview.warnings.map(warning => <p key={warning} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{warning}</p>)}
            <div className="max-h-[48vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Строка</TableHead><TableHead>Гость</TableHead><TableHead>Номер</TableHead><TableHead>Заезд</TableHead><TableHead>Выезд</TableHead><TableHead>Проверка</TableHead></TableRow></TableHeader>
                <TableBody>{rows.map((row, index) => (
                  <TableRow key={`${row.sourceRow}-${row.roomNumber}-${row.checkIn}-${index}`}>
                    <TableCell>{row.sourceRow}</TableCell>
                    <TableCell><Input aria-label={`Гость, строка ${row.sourceRow}`} value={row.guestName} onChange={event => update(index, { guestName: event.target.value })} className="min-w-40" /></TableCell>
                    <TableCell><Input aria-label={`Номер, строка ${row.sourceRow}`} value={row.roomNumber} onChange={event => update(index, { roomNumber: event.target.value })} className="w-24" /></TableCell>
                    <TableCell><Input aria-label={`Заезд, строка ${row.sourceRow}`} type="date" value={row.checkIn} onChange={event => update(index, { checkIn: event.target.value })} /></TableCell>
                    <TableCell><Input aria-label={`Выезд, строка ${row.sourceRow}`} type="date" value={row.checkOut} onChange={event => update(index, { checkOut: event.target.value })} /></TableCell>
                    <TableCell className={row.warning ? "max-w-64 whitespace-normal text-amber-700" : "text-emerald-700"}>{row.warning ?? "Готово"}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset} disabled={pending}>Назад</Button>
              <Button type="button" onClick={confirm} disabled={pending || !rows.length}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null} Импортировать {rows.length}
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {result ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-emerald-50 px-3 py-2 font-medium text-emerald-900">Импортировано: {result.imported}</p>
            {result.errors.length ? <div className="rounded-lg border p-3"><p className="mb-2 font-medium">Требуют ручной проверки: {result.errors.length}</p>
              <ul className="space-y-1 text-sm text-muted-foreground">{result.errors.map((error, index) => <li key={`${error.sourceRow}-${index}`}>Строка {error.sourceRow}: {error.message}</li>)}</ul>
            </div> : null}
            <DialogFooter><Button type="button" onClick={() => setOpen(false)}>Закрыть</Button></DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
