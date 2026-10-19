"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp, LifeBuoy, MessageSquareText, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitSupportRequestAction } from "@/server/actions/support";

const CATEGORY_LABELS = {
  QUESTION: "Вопрос по работе",
  PROBLEM: "Что-то не работает",
  SUGGESTION: "Предложение",
} as const;

type SupportCategory = keyof typeof CATEGORY_LABELS;

export function SupportDialog({ compact = false, locale = "ru" }: { compact?: boolean; locale?: "ru" | "kk" }) {
  const kk = locale === "kk";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SupportCategory>("QUESTION");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await submitSupportRequestAction({ category, message, sourcePath: pathname });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setMessage("");
      setCategory("QUESTION");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          data-tour-id="help"
          className={compact ? "size-9" : "mb-2 min-h-11 w-full justify-start gap-3 px-3 text-muted-foreground hover:text-foreground"}
          size={compact ? "icon" : "default"}
          aria-label={compact ? (kk ? "Көмек" : "Помощь") : undefined}
        >
          <LifeBuoy className="size-4" />
          {compact ? null : (kk ? "Көмек" : "Помощь")}
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <div className="bg-primary px-6 py-5 text-primary-foreground">
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-white/15">
            <MessageSquareText className="size-5" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-primary-foreground">{kk ? "Қалай көмектесе аламыз?" : "Чем мы можем помочь?"}</DialogTitle>
            <DialogDescription className="text-primary-foreground/75">
              {kk ? "Хабарлама нысан атауымен және ағымдағы бөліммен бірге қолдау қызметіне жіберіледі." : "Сообщение сохранится вместе с названием объекта и текущим разделом для службы поддержки."}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="support-category">{kk ? "Тақырып" : "Тема"}</Label>
            <Select value={category} onValueChange={(value: SupportCategory) => setCategory(value)}>
              <SelectTrigger id="support-category" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{kk ? ({ QUESTION: "Жұмыс туралы сұрақ", PROBLEM: "Ақаулық", SUGGESTION: "Ұсыныс" } as const)[value as SupportCategory] : label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="support-message">{kk ? "Хабарлама" : "Сообщение"}</Label>
            <Textarea
              id="support-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={kk ? "Не істегіңіз келді және қай жерде сұрақ туындады?" : "Расскажите, что вы хотели сделать и где возник вопрос…"}
              className="min-h-32 resize-none"
              maxLength={2000}
            />
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><CircleHelp className="size-3.5" />{kk ? "Аккаунттағы байланыс арқылы жауап береміз" : "Ответим по контакту вашего аккаунта"}</span>
              <span>{message.length}/2000</span>
            </div>
          </div>
        </div>
        <DialogFooter className="border-t bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>{kk ? "Жабу" : "Закрыть"}</Button>
          <Button onClick={submit} disabled={pending || message.trim().length < 10}>
            <Send className="size-4" />{pending ? (kk ? "Жіберілуде…" : "Отправляем…") : (kk ? "Жіберу" : "Отправить")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

