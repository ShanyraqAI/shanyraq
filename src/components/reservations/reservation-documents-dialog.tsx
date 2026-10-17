"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Download, FileCheck2, FileText, Loader2, ReceiptText, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createReservationDocumentAction, getReservationDocumentWorkspaceAction } from "@/server/actions/documents";
import type { DocumentDraft, DocumentType, GeneratedDocumentListItem } from "@/lib/documents/schema";
import { cn, formatMoney } from "@/lib/utils";
import { formatISOCompactDate } from "@/lib/dates";

const TYPE_META: Record<DocumentType, { label: string; hint: string; icon: typeof FileText }> = {
  CONTRACT: { label: "Договор квартиры", hint: "Договор найма на период проживания", icon: FileText },
  INVOICE: { label: "Счёт-фактура", hint: "Для оплаты компанией или командировки", icon: ReceiptText },
  ACT: { label: "Акт выполненных работ", hint: "Подтверждение оказанной услуги", icon: FileCheck2 },
};

const STEPS = ["Тип документа", "Заказчик", "Проживание и сумма", "Проверка"] as const;

function Field({ label, value, onChange, required, type = "text", placeholder }: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return <div className="space-y-1.5"><Label>{label}{required ? " *" : ""}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} /></div>;
}

function ReservationDocumentsEditor({ reservationId, open, onOpenChange, onCreated, settingsInNewTab = false }: { reservationId: string; open: boolean; onOpenChange: (open: boolean) => void; onCreated?: () => void; settingsInNewTab?: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  const [documents, setDocuments] = useState<GeneratedDocumentListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const set = <K extends keyof DocumentDraft>(key: K, value: DocumentDraft[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);

  async function load() {
    setLoading(true); setLoadError(null);
    try {
      const result = await getReservationDocumentWorkspaceAction(reservationId);
      if (!result.ok || !result.data) setLoadError(result.error ?? "Не удалось загрузить документы");
      else {
        setDraft(result.data.draft);
        setDocuments(result.data.documents);
        setProfileReady(Boolean(result.data.profile));
      }
    } catch {
      setLoadError("Не удалось загрузить документы. Повторите попытку.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    void getReservationDocumentWorkspaceAction(reservationId).then((result) => {
      if (!active) return;
      setStep(0);
      if (!result.ok || !result.data) setLoadError(result.error ?? "Не удалось загрузить документы");
      else {
        setDraft(result.data.draft);
        setDocuments(result.data.documents);
        setProfileReady(Boolean(result.data.profile));
      }
    }).catch(() => { if (active) setLoadError("Не удалось загрузить документы. Повторите попытку."); });
    return () => { active = false; };
  }, [open, reservationId]);

  async function downloadDocument(documentId: string) {
    setDownloadingId(documentId);
    try {
      const response = await fetch(`/api/documents/${documentId}/pdf`, { credentials: "same-origin" });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("application/pdf")) {
        const message = (await response.text()).trim();
        toast.error(message || "Не удалось скачать PDF");
        return;
      }
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? `document-${documentId}.pdf`;
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Не удалось скачать PDF. Проверьте соединение и попробуйте снова.");
    } finally {
      setDownloadingId(null);
    }
  }

  // Each step submits the form so the browser validates only the fields currently shown.
  async function submitStep(event: React.FormEvent) {
    event.preventDefault();
    if (step < STEPS.length - 1) setStep((value) => value + 1);
    else await create();
  }

  async function create() {
    if (!draft) return;
    setCreating(true);
    try {
      const result = await createReservationDocumentAction(draft);
      if (!result.ok || !result.data) toast.error(result.error ?? "Не удалось создать документ");
      else {
        toast.success(`${result.message} № ${result.data.documentNumber}`);
        if (onCreated) { onCreated(); return; }
        await downloadDocument(result.data.id);
        await load();
      }
    } catch {
      toast.error("Не удалось создать документ. Проверьте историю перед повторной попыткой.");
    } finally {
      setCreating(false);
    }
  }

  const customerLabel = draft ? (draft.customerType === "COMPANY" ? draft.companyName || "Компания" : draft.guestFullName || "Гость") : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl max-sm:inset-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:bg-[#f8f8f4] max-sm:ring-0">
        <DialogHeader className="shrink-0 gap-1 border-b px-4 pt-[max(env(safe-area-inset-top),16px)] pb-3 text-left sm:pt-4">
          <div className="flex items-center gap-3 pr-8">
            {step > 0 ? <button type="button" onClick={() => setStep((value) => value - 1)} className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#536059] ring-1 ring-[#e6e8df]" aria-label="Назад"><ChevronLeft className="size-5" /></button> : null}
            <div className="min-w-0">
              <DialogTitle className="text-lg">Документы по брони</DialogTitle>
              <DialogDescription className="text-xs">Шаг {step + 1} из {STEPS.length} · {STEPS[step]}</DialogDescription>
            </div>
          </div>
          <div className="mt-2 flex gap-1.5">{STEPS.map((label, index) => <span key={label} className={cn("h-1 flex-1 rounded-full bg-[#e3e5dd]", index <= step && "bg-primary")} />)}</div>
        </DialogHeader>

        {loadError ? <div role="alert" className="space-y-3 p-4"><p>{loadError}</p><Button type="button" className="min-h-11" onClick={() => void load()}>Повторить загрузку</Button></div> : loading || !draft ? <div className="flex min-h-40 flex-1 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : (
          <form onSubmit={submitStep} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {step === 0 ? <>
                {!profileReady ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    <div className="font-semibold">Сначала один раз заполните реквизиты владельца</div>
                    <p className="mt-1 text-xs">ИИН/БИН, адрес, банк и подписант сохраняются в настройках и дальше подставляются в каждый документ автоматически.</p>
                    {settingsInNewTab ? <div className="mt-3 space-y-2"><Button type="button" asChild variant="outline" className="min-h-11 bg-white"><a href="/dashboard/settings?section=company" target="_blank" rel="noopener noreferrer"><Settings2 className="size-4" />Заполнить в новой вкладке</a></Button><p className="text-xs">Сообщение останется здесь. После сохранения реквизитов нажмите «Проверить реквизиты».</p><Button type="button" variant="outline" className="min-h-11 bg-white" onClick={() => void load()}>Проверить реквизиты</Button></div> : <Button type="button" size="sm" variant="outline" className="mt-3 bg-white" onClick={() => router.push("/dashboard/settings?section=company")}><Settings2 className="mr-2 size-4" />Заполнить реквизиты</Button>}
                  </div>
                ) : <p className="text-xs text-muted-foreground">Реквизиты владельца подставим из настроек. Выберите, какой документ нужен.</p>}
                <div className="space-y-2">
                  {(Object.keys(TYPE_META) as DocumentType[]).map((type) => {
                    const Icon = TYPE_META[type].icon;
                    const active = draft.type === type;
                    return <button key={type} type="button" onClick={() => set("type", type)} aria-pressed={active} className={cn("flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-white px-3 py-3 text-left shadow-[0_5px_18px_rgb(38_61_51/0.045)] transition", active ? "border-primary ring-1 ring-primary" : "border-border")}>
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary", active && "bg-primary text-primary-foreground")}><Icon className="size-5" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{TYPE_META[type].label}</span><span className="block text-xs text-muted-foreground">{TYPE_META[type].hint}</span></span>
                      {active ? <Check className="size-4 text-primary" /> : null}
                    </button>;
                  })}
                </div>
                {documents.length ? <div className="space-y-2 pt-2"><h3 className="text-sm font-bold">Ранее созданные</h3>{documents.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm"><div><div className="font-medium">{TYPE_META[item.type].label} № {item.documentNumber}</div><div className="text-xs text-muted-foreground">{item.documentDate}</div></div><Button type="button" size="sm" variant="ghost" disabled={downloadingId !== null} onClick={() => void downloadDocument(item.id)}>{downloadingId === item.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}PDF</Button></div>)}</div> : null}
              </> : null}

              {step === 1 ? <>
                <div className="grid h-11 grid-cols-2 gap-1 rounded-xl bg-white p-1 ring-1 ring-border">
                  {([["INDIVIDUAL", "Физлицо"], ["COMPANY", "Компания"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={draft.customerType === value} onClick={() => set("customerType", value)} className="rounded-lg text-xs font-bold text-muted-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground">{label}</button>)}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="ФИО гостя" value={draft.guestFullName} onChange={(value) => set("guestFullName", value)} required />
                  <Field label="ИИН гостя" value={draft.guestIin} onChange={(value) => set("guestIin", value.replace(/\D/g, "").slice(0, 12))} required={draft.customerType === "INDIVIDUAL"} placeholder="12 цифр" />
                  {draft.type === "CONTRACT" && draft.customerType === "INDIVIDUAL" ? <div className="sm:col-span-2"><Field label="Удостоверение личности / паспорт гостя" value={draft.guestIdentityDocument} onChange={(value) => set("guestIdentityDocument", value)} required /></div> : null}
                  <Field label="Дата документа" type="date" value={draft.documentDate} onChange={(value) => set("documentDate", value)} required />
                </div>
                {draft.customerType === "COMPANY" ? <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                  <Field label="Наименование компании" value={draft.companyName} onChange={(value) => set("companyName", value)} required />
                  <Field label="БИН компании" value={draft.companyBin} onChange={(value) => set("companyBin", value.replace(/\D/g, "").slice(0, 12))} required />
                  <div className="sm:col-span-2"><Field label="Адрес компании" value={draft.companyAddress} onChange={(value) => set("companyAddress", value)} required /></div>
                  <Field label="IBAN компании" value={draft.companyIban} onChange={(value) => set("companyIban", value.toUpperCase())} />
                  <Field label="БИК / банк" value={draft.companyBic} onChange={(value) => set("companyBic", value.toUpperCase())} />
                  <Field label="Представитель" value={draft.representativeName} onChange={(value) => set("representativeName", value)} required />
                  <Field label="ИИН представителя" value={draft.representativeIin} onChange={(value) => set("representativeIin", value.replace(/\D/g, "").slice(0, 12))} required={draft.type === "CONTRACT"} />
                  <Field label="Должность представителя" value={draft.representativeTitle} onChange={(value) => set("representativeTitle", value)} />
                  <Field label="Основание полномочий" value={draft.representativeAuthority} onChange={(value) => set("representativeAuthority", value)} placeholder="Устав, доверенность" />
                </div> : null}
              </> : null}

              {step === 2 ? <>
                <p className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground">Заполнили по брони: {formatISOCompactDate(draft.checkIn)} — {formatISOCompactDate(draft.checkOut)}, {formatMoney(draft.totalAmount)}. Проверьте и при необходимости измените.</p>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="col-span-2"><Field label="Адрес квартиры" value={draft.propertyAddress} onChange={(value) => set("propertyAddress", value)} required /></div>
                  <Field label="Заезд" type="date" value={draft.checkIn} onChange={(value) => set("checkIn", value)} required />
                  <Field label="Время заезда" type="time" value={draft.checkInTime} onChange={(value) => set("checkInTime", value)} required />
                  <Field label="Выезд" type="date" value={draft.checkOut} onChange={(value) => set("checkOut", value)} required />
                  <Field label="Время выезда" type="time" value={draft.checkOutTime} onChange={(value) => set("checkOutTime", value)} required />
                  <Field label="Количество" type="number" value={draft.quantity} onChange={(value) => set("quantity", Number(value))} required />
                  <Field label="Единица" value={draft.unit} onChange={(value) => set("unit", value)} required />
                  <Field label="Цена за сутки" type="number" value={draft.unitPrice} onChange={(value) => set("unitPrice", Number(value))} required />
                  <Field label="Итоговая сумма" type="number" value={draft.totalAmount} onChange={(value) => set("totalAmount", Number(value))} required />
                  {draft.type === "CONTRACT" ? <><Field label="Максимум гостей" type="number" value={draft.maxGuests} onChange={(value) => set("maxGuests", Number(value))} required /><Field label="Штраф за ключи" type="number" value={draft.keyLossFine} onChange={(value) => set("keyLossFine", Number(value))} required /></> : null}
                  {draft.type === "ACT" ? <div className="col-span-2"><Field label="Дата выполнения услуги" type="date" value={draft.completionDate} onChange={(value) => set("completionDate", value)} required /></div> : null}
                </div>
              </> : null}

              {step === 3 ? <>
                <div className="space-y-2 rounded-2xl border bg-white p-4 text-sm">
                  <SummaryRow label="Документ" value={TYPE_META[draft.type].label} />
                  <SummaryRow label="Заказчик" value={customerLabel} />
                  <SummaryRow label="Период" value={`${formatISOCompactDate(draft.checkIn)} — ${formatISOCompactDate(draft.checkOut)}`} />
                  <SummaryRow label="Сумма" value={formatMoney(draft.totalAmount)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2"><Label>Описание услуги *</Label><Textarea value={draft.serviceDescription} onChange={(event) => set("serviceDescription", event.target.value)} required rows={3} /></div>
                  <Field label="Условия оплаты" value={draft.paymentTerms} onChange={(value) => set("paymentTerms", value)} required />
                  <Field label="Основание / номер договора" value={draft.contractReference} onChange={(value) => set("contractReference", value)} placeholder="Необязательно" />
                  <Field label="Подписант заказчика" value={draft.customerSignerName} onChange={(value) => set("customerSignerName", value)} />
                  <Field label="Должность подписанта" value={draft.customerSignerTitle} onChange={(value) => set("customerSignerTitle", value)} />
                </div>
                {draft.type === "INVOICE" ? <p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">PDF создаётся для скачивания и обмена. Shanyraq AI не отправляет его в ИС ЭСФ и не присваивает государственный регистрационный номер.</p> : null}
              </> : null}
            </div>

            <div className="shrink-0 border-t bg-background/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:pb-4">
              <Button type="submit" className="h-12 w-full rounded-[13px] text-sm font-bold" disabled={creating || !profileReady}>
                {creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : step === STEPS.length - 1 ? <Download className="mr-2 size-4" /> : null}
                {step === 0 ? "Начать" : step === STEPS.length - 1 ? (onCreated ? "Создать PDF и вернуться к сообщению" : "Создать и скачать PDF") : "Далее"}
                {step < STEPS.length - 1 ? <ChevronRight className="ml-1 size-4" /> : null}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-bold">{value}</span></div>;
}

/** Remount private workspace on booking/open changes instead of rendering stale data. */
export function ReservationDocumentsDialog(props: Parameters<typeof ReservationDocumentsEditor>[0]) {
  return <ReservationDocumentsEditor key={`${props.reservationId}:${props.open}`} {...props} />;
}
