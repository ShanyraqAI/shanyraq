"use client";

import { useState, useTransition } from "react";
import { MessageSquareText, Star } from "lucide-react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { dismissContextualFeedbackAction, submitContextualFeedbackAction } from "@/server/actions/support";

type FeedbackCategory = "PROBLEM" | "CONFUSING" | "SUGGESTION";

export function ContextualFeedbackPrompt() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory>("CONFUSING");
  const [message, setMessage] = useState("");
  const [handled, setHandled] = useState(false);
  const [pending, startTransition] = useTransition();

  function dismiss() {
    if (handled || pending) return;
    setHandled(true);
    setOpen(false);
    startTransition(async () => {
      const result = await dismissContextualFeedbackAction({ trigger: "FIRST_RESERVATION" });
      if (!result.ok) toast.error(result.error ?? "Не удалось скрыть опрос");
    });
  }

  function submit() {
    if (!rating || pending) return;
    startTransition(async () => {
      const result = await submitContextualFeedbackAction({
        category,
        rating,
        message,
        sourcePath: pathname,
        trigger: "FIRST_RESERVATION",
      });
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось отправить оценку");
        return;
      }
      setHandled(true);
      setOpen(false);
      toast.success(result.message ?? "Спасибо за обратную связь");
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageSquareText className="size-5" /></div>
          <DialogTitle>Как прошло первое бронирование?</DialogTitle>
          <DialogDescription>Поставьте короткую оценку. Ответ увидит только команда Shanyraq.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Оценка</Label>
            <div className="flex gap-1" role="radiogroup" aria-label="Оценка от одного до пяти">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} из 5`}
                  onClick={() => setRating(value)}
                  className="rounded-lg p-1.5 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star className={cn("size-7", value <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-category">Что лучше описывает ваш опыт?</Label>
            <Select value={category} onValueChange={(value: FeedbackCategory) => setCategory(value)}>
              <SelectTrigger id="feedback-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CONFUSING">Что-то было непонятно</SelectItem>
                <SelectItem value="PROBLEM">Что-то не сработало</SelectItem>
                <SelectItem value="SUGGESTION">Есть предложение</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message">Что было сложно? <span className="font-normal text-muted-foreground">Необязательно</span></Label>
            <Textarea id="feedback-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={4} placeholder="Расскажите одним-двумя предложениями…" />
            <p className="text-right text-xs text-muted-foreground">{message.length}/2000</p>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">Мы сохраняем текущий раздел и версию приложения, но не прикладываем данные гостя или содержимое бронирования.</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={dismiss} disabled={pending}>Не сейчас</Button>
          <Button type="button" onClick={submit} disabled={pending || rating === 0}>{pending ? "Отправляем…" : "Отправить оценку"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
