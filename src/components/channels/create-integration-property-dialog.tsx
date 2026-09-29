"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createIntegrationPropertyAction } from "@/server/actions/channex";

export function CreateIntegrationPropertyDialog({ locale }: { locale: "ru" | "kk" }) {
  const kk = locale === "kk";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ name: "", propertyType: "APARTMENT", city: "", address: "", unitCount: "1", capacity: "2", basePrice: "" });
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  function submit() {
    startTransition(async () => {
      const result = await createIntegrationPropertyAction(values);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(kk ? "Нысан жасалды" : "Объект создан");
      setOpen(false);
      setValues({ name: "", propertyType: "APARTMENT", city: "", address: "", unitCount: "1", capacity: "2", basePrice: "" });
      router.refresh();
    });
  }

  const ready = values.name.trim().length >= 2 && values.city.trim().length >= 2 && values.address.trim().length >= 3 && Number(values.unitCount) > 0 && Number(values.capacity) > 0 && Number(values.basePrice) > 0;
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button><Plus className="size-4" />{kk ? "Нысан қосу" : "Добавить объект"}</Button></DialogTrigger>
    <DialogContent className="max-h-[92dvh] overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-full max-sm:-translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl sm:max-w-lg">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="size-5 text-primary" />{kk ? "Жаңа нысан" : "Новый объект"}</DialogTitle><DialogDescription>{kk ? "Негізгі деректерді енгізіңіз. Пәтерлер мен базалық тариф автоматты түрде жасалады." : "Укажите основные данные. Квартиры и базовый тариф будут созданы автоматически."}</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-2 sm:grid-cols-2">
        <Field className="sm:col-span-2" label={kk ? "Пәтерлер тобының атауы" : "Название группы квартир"}><Input value={values.name} onChange={(event) => set("name", event.target.value)} placeholder={kk ? "Мысалы, Abay Apartments" : "Например, Abay Apartments"} /></Field>
        <Field label={kk ? "Қала" : "Город"}><Input value={values.city} onChange={(event) => set("city", event.target.value)} placeholder="Алматы" /></Field>
        <Field className="sm:col-span-2" label={kk ? "Мекенжай" : "Адрес"}><Input value={values.address} onChange={(event) => set("address", event.target.value)} placeholder={kk ? "Көше, үй" : "Улица, дом"} /></Field>
        <Field label={kk ? "Пәтер саны" : "Количество квартир"}><Input type="number" min="1" max="100" inputMode="numeric" value={values.unitCount} onChange={(event) => set("unitCount", event.target.value)} /></Field>
        <Field label={kk ? "Бір пәтердегі орын" : "Мест в каждой квартире"}><Input type="number" min="1" max="30" inputMode="numeric" value={values.capacity} onChange={(event) => set("capacity", event.target.value)} /></Field>
        <Field className="sm:col-span-2" label={kk ? "Бір түннің базалық бағасы, KZT" : "Базовая цена за ночь, KZT"}><Input type="number" min="1" step="500" inputMode="numeric" value={values.basePrice} onChange={(event) => set("basePrice", event.target.value)} placeholder="25000" /></Field>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{kk ? "Бас тарту" : "Отмена"}</Button><Button onClick={submit} disabled={!ready || pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{kk ? "Нысан жасау" : "Создать объект"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <div className={`space-y-1.5 ${className}`}><Label>{label}</Label>{children}</div>; }
