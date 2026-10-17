"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ApartmentShare({ text, locale }: { text: string; locale: "ru" | "kk" }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const kk = locale === "kk";
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  async function handoff() {
    setBusy(true); setNotice("");
    try {
      if (navigator.share) {
        await navigator.share({ text });
        setNotice(kk ? "Қолданба мәзірі жабылды. Жіберу расталмайды." : "Меню приложений закрыто. Отправка и получатель не подтверждены.");
      } else {
        await navigator.clipboard.writeText(text);
        setNotice(kk ? "Мәтін көшірілді." : "Текст скопирован.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setNotice(kk ? "Мәтінді қолмен көшіріңіз." : "Не удалось открыть меню. Выделите и скопируйте текст вручную.");
    } finally { setBusy(false); }
  }
  return <><Button variant="outline" className="min-h-11 shrink-0" onClick={() => { setNotice(""); setOpen(true); }}><Share2 className="size-4" />{kk ? "Бөлісу" : "Поделиться"}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg [&>button]:size-11"><DialogHeader><DialogTitle>{kk ? "Пәтердің таныстырылымы" : "Презентация квартиры"}</DialogTitle><DialogDescription>{kk ? "Тек жалпы ақпарат. Қонақтың деректері мен кіру кодтары жоқ." : "Только общие сведения. Без адреса, приватных фото, данных гостя и кодов доступа."}</DialogDescription></DialogHeader><p className="whitespace-pre-wrap break-words text-base leading-relaxed">{text}</p><p className="text-sm text-muted-foreground">{kk ? "Қонаққа нұсқауларды жіберу үшін оның бронін ашыңыз." : "Чтобы отправить инструкции проживающему гостю, откройте его бронирование."}</p><Button className="min-h-12" disabled={busy} onClick={handoff}>{kk ? (canShare ? "Қолданбаны таңдау" : "Мәтінді көшіру") : (canShare ? "Выбрать приложение" : "Скопировать текст")}</Button>{notice ? <p role="status" className="text-sm">{notice}</p> : null}</DialogContent></Dialog>
  </>;
}
