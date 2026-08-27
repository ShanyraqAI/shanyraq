"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";

const PROPERTY_TYPES = [
  "Отель",
  "Апарт-отель",
  "Апартаменты",
  "Хостел",
  "Гостевой дом",
  "Другое",
];

const COUNTRIES = ["Казахстан", "Россия", "Узбекистан", "Киргизия", "Другое"];

const CURRENCIES = ["KZT", "USD", "EUR"];

const TIMEZONES = [
  "Asia/Almaty",
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

interface RoomTypeInput {
  id: string;
  name: string;
  count: number;
  capacity: number;
  basePrice: number;
}

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Hotel info
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Казахстан");
  const [language, setLanguage] = useState("ru");
  const [currency, setCurrency] = useState("KZT");
  const [timezone, setTimezone] = useState("Asia/Almaty");

  // Step 2: Property type
  const [propertyType, setPropertyType] = useState("");

  // Step 3: Room types
  const [roomTypes, setRoomTypes] = useState<RoomTypeInput[]>([
    { id: "1", name: "Стандарт", count: 10, capacity: 2, basePrice: 35000 },
    { id: "2", name: "Делюкс", count: 5, capacity: 3, basePrice: 48000 },
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelName,
          city,
          country,
          language,
          currency,
          timezone,
          propertyType,
          roomTypes,
        }),
      });

      const result = await response.json();
      if (!result.ok) {
        toast.error(result.error || "Не удалось завершить онбординг");
        return;
      }
      toast.success("Онбординг успешно завершен!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Не удалось завершить онбординг. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  function nextStep() {
    if (step === 1 && !hotelName.trim()) {
      toast.error("Введите название отеля");
      return;
    }
    if (step === 2 && !propertyType) {
      toast.error("Выберите тип объекта");
      return;
    }
    if (step === 3 && roomTypes.length === 0) {
      toast.error("Добавьте хотя бы один тип номера");
      return;
    }
    if (step < 3) setStep(step + 1);
  }

  function prevStep() {
    if (step > 1) setStep(step - 1);
  }

  function addRoomType() {
    setRoomTypes([...roomTypes, { id: Date.now().toString(), name: "", count: 1, capacity: 1, basePrice: 0 }]);
  }

  function removeRoomType(id: string) {
    if (roomTypes.length <= 1) {
      toast.error("Должен быть хотя бы один тип номера");
      return;
    }
    setRoomTypes(roomTypes.filter((r) => r.id !== id));
  }

  function updateRoomType(id: string, field: keyof RoomTypeInput, value: string | number) {
    setRoomTypes(roomTypes.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  const steps = [
    { label: t.onboarding.step1Title, description: t.onboarding.step1Desc },
    { label: t.onboarding.step2Title, description: t.onboarding.step2Desc },
    { label: t.onboarding.step3Title, description: t.onboarding.step3Desc },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    i + 1 < step
                      ? "bg-primary text-primary-foreground"
                      : i + 1 === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1 < step ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="hidden sm:block ml-3 text-left">
                  <p className="font-medium text-sm">{steps[i].label}</p>
                  <p className="text-xs text-muted-foreground">{steps[i].description}</p>
                </div>
                {i < 2 && (
                  <div className="hidden sm:block ml-2 flex-1 h-0.5 bg-muted" />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{steps[step - 1].label}</CardTitle>
              <CardDescription>{steps[step - 1].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Hotel info */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="hotel-name">{t.onboarding.hotelName}</Label>
                    <Input
                      id="hotel-name"
                      value={hotelName}
                      onChange={(e) => setHotelName(e.target.value)}
                      placeholder={t.onboarding.hotelNamePlaceholder}
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="city">{t.onboarding.city}</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder={t.onboarding.cityPlaceholder}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="country">{t.onboarding.country}</Label>
                      <Select value={country} onValueChange={setCountry}>
                        <SelectTrigger>
                          <SelectValue placeholder={t.onboarding.countryPlaceholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="language">{t.onboarding.language}</Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ru">Русский</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="kk">Қазақша</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="currency">{t.onboarding.currency}</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="timezone">{t.onboarding.timezone}</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger>
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
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Property type */}
              {step === 2 && (
                <div className="space-y-6">
                  <Label>{t.onboarding.propertyType}</Label>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {PROPERTY_TYPES.map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => setPropertyType(type)}
                        className={`relative aspect-square p-6 rounded-xl border-2 text-center transition-all hover:border-primary/50 ${
                          propertyType === type
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <p className="font-medium">{type}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Room types */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Label>{t.onboarding.roomTypes}</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addRoomType}>
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t.onboarding.addRoomType}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {roomTypes.map((room) => (
                      <Card key={room.id} className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex-1 space-y-3">
                            <div className="grid gap-3 sm:grid-cols-4">
                              <div className="space-y-1.5">
                                <Label htmlFor={`name-${room.id}`}>{t.onboarding.roomName}</Label>
                                <Input
                                  id={`name-${room.id}`}
                                  value={room.name}
                                  onChange={(e) => updateRoomType(room.id, "name", e.target.value)}
                                  placeholder={t.onboarding.roomNamePlaceholder}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`count-${room.id}`}>{t.onboarding.roomCount}</Label>
                                <Input
                                  id={`count-${room.id}`}
                                  type="number"
                                  min={1}
                                  value={room.count}
                                  onChange={(e) => updateRoomType(room.id, "count", parseInt(e.target.value) || 1)}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`capacity-${room.id}`}>{t.onboarding.capacity}</Label>
                                <Input
                                  id={`capacity-${room.id}`}
                                  type="number"
                                  min={1}
                                  value={room.capacity}
                                  onChange={(e) => updateRoomType(room.id, "capacity", parseInt(e.target.value) || 1)}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`price-${room.id}`}>{t.onboarding.basePrice}</Label>
                                <Input
                                  id={`price-${room.id}`}
                                  type="number"
                                  min={0}
                                  step={1000}
                                  value={room.basePrice}
                                  onChange={(e) => updateRoomType(room.id, "basePrice", parseInt(e.target.value) || 0)}
                                  required
                                />
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-red-50"
                            onClick={() => removeRoomType(room.id)}
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={step === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              {t.common.back}
            </Button>
            <div className="flex gap-2">
              {step < 3 && (
                <Button type="button" onClick={nextStep}>
                  {t.common.next}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              {step === 3 && (
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t.onboarding.complete}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}