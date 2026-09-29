"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveHotelSettingsAction } from "@/server/actions/settings";
import { t } from "@/lib/i18n";

export interface HotelSettingsValues {
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  currency: string;
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  houseRules: string;
}

const TIMEZONES = [
  "Asia/Almaty",
  "Asia/Qyzylorda",
  "Asia/Aqtobe",
  "Asia/Aqtau",
  "Asia/Oral",
  "Asia/Tashkent",
  "Asia/Bishkek",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Europe/London",
  "UTC",
];

export function SettingsForm({ initial, section = "company" }: { initial: HotelSettingsValues; section?: "company" | "rules" | "stay" }) {
  const router = useRouter();
  const [values, setValues] = useState<HotelSettingsValues>(initial);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof HotelSettingsValues>(key: K, value: HotelSettingsValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await saveHotelSettingsAction(values);
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
    <form onSubmit={save} className="max-w-4xl space-y-5 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      {section === "company" ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="hotel-name">{t.settings.form.hotelName}</Label>
          <Input id="hotel-name" value={values.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="hotel-address">{t.settings.form.address}</Label>
          <Input id="hotel-address" value={values.address ?? ""} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hotel-city">{t.settings.form.city}</Label>
          <Input id="hotel-city" value={values.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hotel-country">{t.settings.form.country}</Label>
          <Input id="hotel-country" value={values.country ?? ""} onChange={(e) => set("country", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hotel-tz">{t.settings.form.timezone}</Label>
          <Select value={values.timezone} onValueChange={(v) => set("timezone", v)}>
            <SelectTrigger id="hotel-tz" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t.settings.form.timezoneHint}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hotel-currency">{t.settings.form.currency}</Label>
          <Select value={values.currency} onValueChange={(v) => set("currency", v)}>
            <SelectTrigger id="hotel-currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["KZT", "USD", "EUR"].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div> : null}

      {section !== "company" ? <div className="rounded-2xl border border-[#e6ece7] bg-[#f8faf7] p-4 sm:p-5">
        <div className="mb-4"><h3 className="text-sm font-bold text-[#26342d]">{section === "rules" ? "Правила проживания" : "Время заезда и выезда"}</h3><p className="mt-1 text-xs text-muted-foreground">{section === "rules" ? "Правила будут видны команде при работе с гостями." : "Время по умолчанию для новых бронирований."}</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {section === "stay" ? <>
          <div className="space-y-1.5"><Label htmlFor="hotel-check-in">Заезд с</Label><Input id="hotel-check-in" type="time" value={values.defaultCheckInTime} onChange={(event) => set("defaultCheckInTime", event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="hotel-check-out">Выезд до</Label><Input id="hotel-check-out" type="time" value={values.defaultCheckOutTime} onChange={(event) => set("defaultCheckOutTime", event.target.value)} /></div>
          </> : <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="hotel-house-rules">Правила для гостя</Label><textarea id="hotel-house-rules" value={values.houseRules} onChange={(event) => set("houseRules", event.target.value)} rows={6} maxLength={4000} placeholder="Например: не курить, соблюдать тишину после 22:00, бережно относиться к квартире." className="w-full resize-y rounded-xl border border-input bg-background px-3 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>}
        </div>
      </div> : null}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          {t.settings.form.save}
        </Button>
      </div>
    </form>
  );
}
