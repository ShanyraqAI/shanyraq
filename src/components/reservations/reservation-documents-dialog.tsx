"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileCheck2, FileText, Loader2, ReceiptText, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createReservationDocumentAction, getReservationDocumentWorkspaceAction } from "@/server/actions/documents";
import type { DocumentDraft, DocumentType, GeneratedDocumentListItem } from "@/lib/documents/schema";

const TYPE_META: Record<DocumentType, { label: string; icon: typeof FileText }> = {
  CONTRACT: { label: "Договор квартиры", icon: FileText },
  INVOICE: { label: "Счёт-фактура", icon: ReceiptText },
  ACT: { label: "Акт выполненных работ", icon: FileCheck2 },
};

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

export function ReservationDocumentsDialog({ reservationId, open, onOpenChange }: { reservationId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  const [documents, setDocuments] = useState<GeneratedDocumentListItem[]>([]);
  const [profileReady, setProfileReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const set = <K extends keyof DocumentDraft>(key: K, value: DocumentDraft[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);

  async function load() {
    setLoading(true);
    try {
      const result = await getReservationDocumentWorkspaceAction(reservationId);
      if (!result.ok || !result.data) toast.error(result.error ?? "Не удалось загрузить документы");
      else {
        setDraft(result.data.draft);
        setDocuments(result.data.documents);
        setProfileReady(Boolean(result.data.profile));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    void getReservationDocumentWorkspaceAction(reservationId).then((result) => {
      if (!active) return;
      if (!result.ok || !result.data) toast.error(result.error ?? "Не удалось загрузить документы");
      else {
        setDraft(result.data.draft);
        setDocuments(result.data.documents);
        setProfileReady(Boolean(result.data.profile));
      }
    });
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

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setCreating(true);
    try {
      const result = await createReservationDocumentAction(draft);
      if (!result.ok || !result.data) toast.error(result.error ?? "Не удалось создать документ");
      else {
        toast.success(`${result.message} № ${result.data.documentNumber}`);
        await downloadDocument(result.data.id);
        await load();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Документы по бронированию</DialogTitle>
          <DialogDescription>Данные владельца подставляются из настроек. Проверьте гостя, заказчика, адрес и сумму.</DialogDescription>
        </DialogHeader>
        {loading || !draft ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : (
          <form onSubmit={create} className="space-y-5">
            {!profileReady ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <div className="font-semibold">Сначала заполните реквизиты владельца</div>
                <p className="mt-1">Без ИИН/БИН, адреса и подписанта документ создать нельзя.</p>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => router.push("/dashboard/settings")}><Settings2 className="mr-2 size-4" />Открыть настройки</Button>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(TYPE_META) as DocumentType[]).map((type) => {
                const Icon = TYPE_META[type].icon;
                return <button key={type} type="button" onClick={() => set("type", type)} className={`rounded-lg border p-3 text-left transition ${draft.type === type ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-secondary/50"}`}><Icon className="mb-2 size-4" /><span className="text-sm font-medium">{TYPE_META[type].label}</span></button>;
              })}
            </div>

            <section className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold">Документ и заказчик</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Дата документа" type="date" value={draft.documentDate} onChange={(value) => set("documentDate", value)} required />
                <div className="space-y-1.5"><Label>Тип заказчика</Label><Select value={draft.customerType} onValueChange={(value) => set("customerType", value as DocumentDraft["customerType"])}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INDIVIDUAL">Физическое лицо</SelectItem><SelectItem value="COMPANY">Компания / командировка</SelectItem></SelectContent></Select></div>
                <Field label="ФИО гостя" value={draft.guestFullName} onChange={(value) => set("guestFullName", value)} required />
                <Field label="ИИН гостя" value={draft.guestIin} onChange={(value) => set("guestIin", value.replace(/\D/g, "").slice(0, 12))} required={draft.customerType === "INDIVIDUAL"} placeholder="12 цифр" />
                {draft.type === "CONTRACT" && draft.customerType === "INDIVIDUAL" ? <div className="sm:col-span-2"><Field label="Удостоверение личности / паспорт гостя" value={draft.guestIdentityDocument} onChange={(value) => set("guestIdentityDocument", value)} required /></div> : null}
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
            </section>

            <section className="space-y-3 rounded-lg border p-4">
              <h3 className="font-semibold">Проживание и стоимость</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Адрес квартиры" value={draft.propertyAddress} onChange={(value) => set("propertyAddress", value)} required /></div>
                <Field label="Заезд" type="date" value={draft.checkIn} onChange={(value) => set("checkIn", value)} required />
                <Field label="Время заезда" type="time" value={draft.checkInTime} onChange={(value) => set("checkInTime", value)} required />
                <Field label="Выезд" type="date" value={draft.checkOut} onChange={(value) => set("checkOut", value)} required />
                <Field label="Время выезда" type="time" value={draft.checkOutTime} onChange={(value) => set("checkOutTime", value)} required />
                <Field label="Количество" type="number" value={draft.quantity} onChange={(value) => set("quantity", Number(value))} required />
                <Field label="Единица" value={draft.unit} onChange={(value) => set("unit", value)} required />
                <Field label="Стоимость за сутки" type="number" value={draft.unitPrice} onChange={(value) => set("unitPrice", Number(value))} required />
                <Field label="Итоговая сумма" type="number" value={draft.totalAmount} onChange={(value) => set("totalAmount", Number(value))} required />
                {draft.type === "CONTRACT" ? <><Field label="Максимум гостей" type="number" value={draft.maxGuests} onChange={(value) => set("maxGuests", Number(value))} required /><Field label="Штраф за утерю ключей" type="number" value={draft.keyLossFine} onChange={(value) => set("keyLossFine", Number(value))} required /></> : null}
                {draft.type === "ACT" ? <Field label="Дата выполнения услуги" type="date" value={draft.completionDate} onChange={(value) => set("completionDate", value)} required /> : null}
                <div className="sm:col-span-2 space-y-1.5"><Label>Описание услуги</Label><Textarea value={draft.serviceDescription} onChange={(event) => set("serviceDescription", event.target.value)} required rows={3} /></div>
                <Field label="Основание / номер договора" value={draft.contractReference} onChange={(value) => set("contractReference", value)} placeholder="Необязательно" />
                <Field label="Условия оплаты" value={draft.paymentTerms} onChange={(value) => set("paymentTerms", value)} required />
                <Field label="Подписант заказчика" value={draft.customerSignerName} onChange={(value) => set("customerSignerName", value)} />
                <Field label="Должность подписанта" value={draft.customerSignerTitle} onChange={(value) => set("customerSignerTitle", value)} />
              </div>
            </section>

            {draft.type === "INVOICE" ? <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">PDF создаётся для скачивания и обмена. Shanyraq AI не отправляет его в ИС ЭСФ и не присваивает государственный регистрационный номер.</p> : null}
            <DialogFooter><Button type="submit" disabled={creating || !profileReady}>{creating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}Создать и скачать PDF</Button></DialogFooter>
          </form>
        )}

        {documents.length ? <div className="space-y-2 border-t pt-4"><h3 className="text-sm font-semibold">Ранее созданные</h3>{documents.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"><div><div className="font-medium">{TYPE_META[item.type].label} № {item.documentNumber}</div><div className="text-xs text-muted-foreground">{item.documentDate}</div></div><Button size="sm" variant="ghost" disabled={downloadingId !== null} onClick={() => void downloadDocument(item.id)}>{downloadingId === item.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}PDF</Button></div>)}</div> : null}
      </DialogContent>
    </Dialog>
  );
}
