"use client";

import { useState } from "react";
import { CircleHelp, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ttlockCopy } from "./ttlock-copy";
import type { AppLocale } from "@/lib/locale";

export function TTLockGuide({ locale }: { locale: AppLocale }) {
  const [open, setOpen] = useState(false);
  const copy = ttlockCopy[locale];
  const guide = copy.guide;
  return <>
    <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline"><CircleHelp className="size-4" />{copy.help}</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogTitle>{guide.title}</DialogTitle>
        <DialogDescription>{guide.description}</DialogDescription>
        <ol className="space-y-3">{guide.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-5 text-slate-700"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">{index + 1}</span><span>{step}</span></li>)}</ol>
        <ul className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{guide.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        <div className="flex items-center justify-between gap-3">
          <a href="https://www.ttlock.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline">{guide.site}<ExternalLink className="size-3.5" /></a>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">{guide.close}</button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
