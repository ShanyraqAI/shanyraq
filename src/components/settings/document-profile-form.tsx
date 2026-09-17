"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Landmark, Loader2, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveDocumentProfileAction } from "@/server/actions/documents";
import type { DocumentProfileValues } from "@/lib/documents/schema";

function Field({ label, value, onChange, required, placeholder, type = "text" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} />
    </div>
  );
}

export function DocumentProfileForm({ initial, canManage }: { initial: DocumentProfileValues; canManage: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof DocumentProfileValues>(key: K, value: DocumentProfileValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await saveDocumentProfileAction(values);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-4xl space-y-5">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="size-4 text-primary" />
          <div>
            <h3 className="font-semibold">Организация или владелец</h3>
            <p className="text-xs text-muted-foreground">Эти данные автоматически попадут во все новые документы.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Тип владельца</Label>
            <Select value={values.entityType} onValueChange={(value) => set("entityType", value as DocumentProfileValues["entityType"])}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL_ENTREPRENEUR">Индивидуальный предприниматель</SelectItem>
                <SelectItem value="LEGAL_ENTITY">ТОО / юридическое лицо</SelectItem>
                <SelectItem value="INDIVIDUAL">Физическое лицо</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="ИИН / БИН" value={values.iinBin} onChange={(value) => set("iinBin", value.replace(/\D/g, "").slice(0, 12))} required placeholder="12 цифр" />
          <div className="sm:col-span-2"><Field label="Полное наименование" value={values.legalName} onChange={(value) => set("legalName", value)} required placeholder="Например: ИП Фамилия Имя Отчество" /></div>
          <div className="sm:col-span-2"><Field label="Юридический адрес" value={values.legalAddress} onChange={(value) => set("legalAddress", value)} required /></div>
          <Field label="Почтовый индекс" value={values.postalCode} onChange={(value) => set("postalCode", value)} />
          <Field label="Удостоверение / документ регистрации" value={values.identityDocument} onChange={(value) => set("identityDocument", value)} />
          <Field label="Телефон" value={values.phone} onChange={(value) => set("phone", value)} type="tel" />
          <Field label="Email" value={values.email} onChange={(value) => set("email", value)} type="email" />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><Landmark className="size-4 text-primary" /><h3 className="font-semibold">Банковские и налоговые реквизиты</h3></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Банк" value={values.bankName} onChange={(value) => set("bankName", value)} />
          <Field label="IBAN" value={values.iban} onChange={(value) => set("iban", value.toUpperCase().replace(/\s/g, "").slice(0, 20))} placeholder="KZ…" />
          <Field label="БИК" value={values.bic} onChange={(value) => set("bic", value.toUpperCase().replace(/\s/g, "").slice(0, 11))} />
          <Field label="КБе" value={values.kbe} onChange={(value) => set("kbe", value)} />
          <div className="space-y-1.5">
            <Label>НДС</Label>
            <Select value={values.vatMode} onValueChange={(value) => set("vatMode", value as DocumentProfileValues["vatMode"])}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="WITHOUT_VAT">Без НДС</SelectItem><SelectItem value="VAT">С НДС</SelectItem></SelectContent>
            </Select>
          </div>
          <Field label="Свидетельство по НДС" value={values.vatRegistrationNumber} onChange={(value) => set("vatRegistrationNumber", value)} />
          <div className="sm:col-span-2"><Field label="Условия оплаты по умолчанию" value={values.defaultPaymentTerms} onChange={(value) => set("defaultPaymentTerms", value)} required /></div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><UserRound className="size-4 text-primary" /><h3 className="font-semibold">Подписание документов</h3></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ФИО подписанта" value={values.signerName} onChange={(value) => set("signerName", value)} required />
          <Field label="Должность" value={values.signerTitle} onChange={(value) => set("signerTitle", value)} required />
          <Field label="Основание полномочий" value={values.signerAuthority} onChange={(value) => set("signerAuthority", value)} placeholder="Устав, доверенность и т. п." />
          <Field label="Главный бухгалтер" value={values.accountantName} onChange={(value) => set("accountantName", value)} placeholder="Оставьте пустым, если не предусмотрен" />
        </div>
      </div>

      {!canManage ? <p className="text-sm text-muted-foreground">Изменять реквизиты может только владелец организации.</p> : null}
      <Button type="submit" disabled={saving || !canManage}>
        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
        Сохранить реквизиты
      </Button>
    </form>
  );
}
