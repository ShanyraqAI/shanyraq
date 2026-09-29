"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Dataset = "calendar" | "reservations" | "guests" | "reports";
type Format = "xlsx";

const DATASET_TITLES: Record<Dataset, string> = {
  calendar: "Экспорт календаря",
  reservations: "Экспорт бронирований",
  guests: "Экспорт гостей",
  reports: "Экспорт отчёта",
};

export function DataExportDialog({ dataset, defaultFrom = "", defaultTo = "", defaultSource = "all", maxTo }: { dataset: Dataset; defaultFrom?: string; defaultTo?: string; defaultSource?: string; maxTo?: string }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [downloading, setDownloading] = useState<Format | null>(null);
  const needsRange = dataset === "calendar" || dataset === "reports";

  async function download(format: Format) {
    if (needsRange && (!from || !to || to < from)) {
      toast.error("Укажите корректный период экспорта.");
      return;
    }
    if (dataset === "reports" && maxTo && to > maxTo) {
      toast.error("Отчёт можно сформировать только по завершённым датам.");
      return;
    }
    setDownloading(format);
    try {
      const params = new URLSearchParams({ format });
      if (needsRange) {
        params.set("from", from);
        params.set("to", to);
      }
      if (dataset === "reports" && defaultSource !== "all") params.set("source", defaultSource);
      const response = await fetch(`/api/exports/${dataset}?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "Не удалось сформировать файл.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? `shanyraq-export.${format}`;
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      toast.success("Файл подготовлен и скачан.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сформировать файл.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Download className="size-4" /> Экспорт</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{DATASET_TITLES[dataset]}</DialogTitle>
          <DialogDescription>Скачайте оформленную Excel-таблицу с фильтрами и закреплённой строкой заголовков.</DialogDescription>
        </DialogHeader>
        {needsRange ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor={`export-${dataset}-from`}>Дата с</Label><Input id={`export-${dataset}-from`} type="date" max={dataset === "reports" ? maxTo : undefined} value={from} onChange={(event) => setFrom(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor={`export-${dataset}-to`}>Дата по</Label><Input id={`export-${dataset}-to`} type="date" min={from} max={dataset === "reports" ? maxTo : undefined} value={to} onChange={(event) => setTo(event.target.value)} /></div>
          </div>
        ) : null}
        <div className="grid gap-3">
          <button type="button" disabled={Boolean(downloading)} onClick={() => download("xlsx")} className="flex min-h-14 items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60">
            {downloading === "xlsx" ? <Loader2 className="mt-0.5 size-5 animate-spin text-primary" /> : <FileSpreadsheet className="mt-0.5 size-5 text-primary" />}
            <span className="font-semibold">Скачать Excel (.xlsx)</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground">В файл попадут только данные текущего отеля, к которым у вас есть доступ.</p>
      </DialogContent>
    </Dialog>
  );
}
