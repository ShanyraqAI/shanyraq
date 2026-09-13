"use client";

import { useState } from "react";
import { Expand } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CalendarPreview } from "./calendar-preview";
import p from "./premium.module.css";

export function CalendarZoom() {
  const [open, setOpen] = useState(false);
  return <div className={p.calendarZoom}>
    <button type="button" onClick={() => setOpen(true)}><Expand size={14} /> Увеличить календарь</button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={p.calendarDialog}>
        <DialogTitle>Календарь бронирований</DialogTitle>
        <DialogDescription>Пример данных. Нажмите на бронь, чтобы посмотреть подробности.</DialogDescription>
        <CalendarPreview />
      </DialogContent>
    </Dialog>
  </div>;
}
