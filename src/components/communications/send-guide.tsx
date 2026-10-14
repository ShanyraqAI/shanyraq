import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SECONDARY_TEXT } from "./fields";
export function SendGuide() {
  return <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-accent/60 p-3 text-primary"><MessageCircle className="size-6" /></span><div><h2 className="text-lg font-semibold">Сообщение гостю за три шага</h2><p className={`mt-2 ${SECONDARY_TEXT}`}>Отправляйте из брони: данные квартиры и гостя подставятся сами.</p></div></div>
    <ol className="space-y-4">{[["Выберите текст", "Оставьте готовый, измените его или напишите свой с нуля."], ["Добавьте по желанию", "Выберите фото квартиры и ссылку на документ — или продолжите без них."], ["Проверьте и отправьте", "Откроется меню приложений. Выберите нужный чат и отправьте сообщение."]].map(([title, description], i) => <li key={title} className="flex items-start gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">{i + 1}</span><div><h3 className="font-semibold">{title}</h3><p className={`mt-1 ${SECONDARY_TEXT}`}>{description}</p></div></li>)}</ol>
    <Button asChild className="min-h-12 w-full rounded-xl"><a href="/dashboard/reservations">Выбрать бронь<ArrowRight className="size-4" /></a></Button>
    <p className={`flex gap-2 ${SECONDARY_TEXT}`}><Check className="mt-0.5 size-4 shrink-0" />Подключать WhatsApp не нужно. Перед отправкой вы сами выбираете приложение и гостя.</p>
    <details className="border-t pt-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Что настроить один раз</summary><p className={`mt-2 ${SECONDARY_TEXT}`}>Во вкладке «Квартиры» сохраните адрес, получение ключей и фото. Во вкладке «Шаблоны» можно сохранить свой текст для следующих гостей. Если шаблонов ещё нет, стандартный текст уже доступен в брони.</p></details>
  </section>;
}
