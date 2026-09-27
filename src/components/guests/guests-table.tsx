"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, MessageCircle, Phone, Plus, Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/page-header";
import { ChannelLabel, ReservationStatusBadge } from "@/components/shared/status-badge";
import { addGuestNoteAction, upsertGuestAction } from "@/server/actions/guests";
import { guestDisplayId, reservationDisplayId, type ReservationVM } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { formatMediumDate } from "@/lib/dates";
import { t } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";

export interface GuestRow {
  id: string;
  sequenceNumber: number | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  notes: string | null;
  internalNotes: Array<{ id: string; content: string; createdAt: string; authorName: string }>;
  reservationCount: number;
  lastStay: string | null; // ISO date of most recent check-in
  lastChannel: string | null;
}

interface Props {
  guests: GuestRow[];
  reservations: ReservationVM[]; // full list to derive history per guest
  initialSelectedId?: string | null;
  locale?: AppLocale;
}

export function GuestsTable({ guests, reservations, initialSelectedId = null, locale = "ru" }: Props) {
  const kk = locale === "kk";
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const router = useRouter();

  async function addNote() {
    if (!selectedId) return;
    setSavingNote(true);
    try {
      const result = await addGuestNoteAction({ guestId: selectedId, content: noteText });
      if (!result.ok) return toast.error(result.error);
      setNoteText("");
      setNoteOpen(false);
      toast.success(result.message);
      router.refresh();
    } finally { setSavingNote(false); }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.fullName.toLowerCase().includes(q) ||
        guestDisplayId(g.sequenceNumber).toLowerCase().includes(q) ||
        (g.email ?? "").toLowerCase().includes(q) ||
        (g.phone ?? "").includes(q),
    );
  }, [guests, query]);

  const selected = guests.find((g) => g.id === selectedId) ?? null;
  const history = useMemo(
    () =>
      selected
        ? reservations
            .filter((r) => r.guestId === selected.id)
            .sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1))
        : [],
    [selected, reservations],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={kk ? "Аты, телефоны немесе ЖСН бойынша іздеу" : t.guests.searchPlaceholder}
            className="h-11 rounded-xl border-[#e7e9e0] bg-white pl-8 text-xs sm:h-9 sm:rounded-md"
          />
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> {kk ? "Қонақ қосу" : "Добавить гостя"}</Button>
        </div>
      </div>

      {guests.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title={t.guests.emptyTitle}
          description="Добавьте гостя вручную или создайте бронирование — карточка останется в базе вашего отеля."
          action={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Добавить гостя</Button>}
        />
      ) : (
        <>
        <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm sm:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead>ID</TableHead>
                <TableHead>{t.guests.table.name}</TableHead>
                <TableHead>{t.dashboard.table.email}</TableHead>
                <TableHead>{t.dashboard.table.phone}</TableHead>
                <TableHead className="text-right">{t.guests.table.reservations}</TableHead>
                <TableHead>{t.guests.table.lastStay}</TableHead>
                <TableHead>{t.guests.table.lastSource}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((g) => (
                <TableRow key={g.id} className="cursor-pointer" onClick={() => setSelectedId(g.id)}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{guestDisplayId(g.sequenceNumber)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {g.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </span>
                      <span className="font-medium">{g.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{g.email ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{g.phone ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.reservationCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {g.lastStay ? formatMediumDate(new Date(`${g.lastStay}T00:00:00Z`)) : "—"}
                  </TableCell>
                  <TableCell>{g.lastChannel ? <ChannelLabel channel={g.lastChannel} /> : "—"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    {t.guests.searchEmpty}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="space-y-2 sm:hidden"><div className="flex items-center justify-between"><h2 className="sh-mobile-section-title">{kk ? "Соңғылар" : "Недавние"}</h2><span className="text-[10px] font-bold text-[#07866b]">{kk ? "Сегменттер" : "Сегменты"}</span></div>{filtered.map((guest, index) => <button key={guest.id} type="button" onClick={() => setSelectedId(guest.id)} className="sh-mobile-card flex min-h-[68px] w-full items-center gap-3 p-3 text-left"><span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-extrabold ${index % 4 === 0 ? "bg-[#ddf2ea] text-[#14846b]" : index % 4 === 1 ? "bg-[#e4edfb] text-[#5187d7]" : index % 4 === 2 ? "bg-[#fbefd8] text-[#c2872e]" : "bg-[#fbe3e1] text-[#df645d]"}`}>{guest.sequenceNumber ?? index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold text-[#303c35]">{guest.fullName}</span><span className="mt-0.5 block truncate text-[9px] text-[#969c95]">{guest.phone ?? guest.email ?? guestDisplayId(guest.sequenceNumber)}</span><span className="mt-1 block text-[9px] text-[#777f78]">{guest.reservationCount} {kk ? "сапар" : "поездок"}{guest.reservationCount > 1 ? <b className="ml-1 text-[#07866b]">· {kk ? "Тұрақты қонақ" : "Постоянный гость"}</b> : null}</span></span><span className="text-[#adb2ac]">›</span></button>)}{filtered.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{kk ? "Ештеңе табылмады." : t.guests.searchEmpty}</p> : null}<Button onClick={() => setCreateOpen(true)} className="sh-mobile-primary mt-2 w-full"><Plus className="size-4" />{kk ? "Қонақ қосу" : "Добавить гостя"}</Button></div>
        </>
      )}

      {/* Details modal — full-screen drawer on mobile via responsive Dialog */}
      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-3 overflow-hidden p-4 max-sm:top-auto max-sm:bottom-0 max-sm:w-full max-sm:max-w-full max-sm:-translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:pb-[max(env(safe-area-inset-bottom),12px)] sm:max-w-xl sm:p-6">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {selected.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </span>
                  {selected.fullName}
                </DialogTitle>
                <DialogDescription>
                  {guestDisplayId(selected.sequenceNumber)} · {t.guests.profile.subtitle}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 rounded-xl bg-secondary/30 p-3 sm:hidden">
                <p className="text-sm font-medium">{selected.phone ?? "Телефон не указан"}</p>
                {selected.phone ? <div className="grid grid-cols-2 gap-2"><Button asChild variant="outline" size="sm" className="h-10"><a href={`tel:${selected.phone}`}><Phone className="size-4" />Позвонить</a></Button><Button asChild variant="outline" size="sm" className="h-10"><a href={`https://wa.me/${selected.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" />WhatsApp</a></Button></div> : null}
                <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Последнее проживание:</span>{history[0] ? <ReservationStatusBadge status={history[0].status} /> : <span>Нет бронирований</span>}</div>
                {selected.notes ? <p className="line-clamp-2 text-xs text-muted-foreground">{selected.notes}</p> : null}
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Редактировать гостя</Button>
              </div>

              <Tabs defaultValue="stays" className="min-h-0 flex-1 overflow-hidden" key={selected.id}>
                <TabsList className="grid w-full shrink-0 grid-cols-3"><TabsTrigger value="stays">Проживания</TabsTrigger><TabsTrigger value="notes">Заметки</TabsTrigger><TabsTrigger value="details">Данные</TabsTrigger></TabsList>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-3">
                <TabsContent value="details" className="space-y-3">

              <dl className="grid overflow-hidden rounded-xl border bg-secondary/15 sm:grid-cols-2">
                <div className="min-w-0 border-b p-3.5 sm:border-r">
                  <dt className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="size-3.5" /> Email</dt>
                  <dd className="mt-1 truncate text-sm font-medium">{selected.email ?? "—"}</dd>
                </div>
                <div className="min-w-0 border-b p-3.5">
                  <dt className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="size-3.5" /> Телефон</dt>
                  <dd className="mt-1 truncate text-sm font-medium">{selected.phone ?? "—"}</dd>
                </div>
                <div className="p-3.5 sm:border-r">
                  <dt className="text-xs text-muted-foreground">{t.guests.profile.country}</dt>
                  <dd className="mt-1 text-sm font-medium">{selected.country ?? "—"}</dd>
                </div>
                <div className="p-3.5">
                  <dt className="text-xs text-muted-foreground">{t.guests.profile.totalStays}</dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums">{history.length}</dd>
                </div>
              </dl>

              {selected.notes ? (
                <div className="rounded-lg border border-dashed bg-secondary/30 p-3 text-sm text-muted-foreground">
                  “{selected.notes}”
                </div>
              ) : null}

                </TabsContent>
                <TabsContent value="notes"><section className="space-y-2">
                <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Внутренние заметки</h3><Button type="button" size="sm" variant="outline" onClick={() => setNoteOpen((value) => !value)}><Plus className="size-3.5" /> Добавить заметку</Button></div>
                {noteOpen ? <div className="space-y-2"><Textarea aria-label="Новая заметка о госте" value={noteText} onChange={(event) => setNoteText(event.target.value)} maxLength={2000} rows={2} placeholder="Видно только сотрудникам отеля" /><Button type="button" size="sm" disabled={savingNote || !noteText.trim()} onClick={addNote}>Сохранить заметку</Button></div> : null}
                {selected.internalNotes.length ? <><ul className="space-y-2">{selected.internalNotes.slice(0, showAllNotes ? undefined : 3).map((note) => <li key={note.id} className="rounded-lg bg-secondary/40 p-2.5 text-sm"><p className="whitespace-pre-wrap">{note.content}</p><p className="mt-1 text-xs text-muted-foreground">{note.authorName} · {new Date(note.createdAt).toLocaleDateString("ru-RU")}</p></li>)}</ul>{selected.internalNotes.length > 3 ? <Button size="sm" variant="ghost" onClick={() => setShowAllNotes((value) => !value)}>{showAllNotes ? "Свернуть" : `Показать все · ${selected.internalNotes.length}`}</Button> : null}</> : <p className="text-xs text-muted-foreground">Заметок пока нет.</p>}
              </section></TabsContent>

              <TabsContent value="stays"><div>
                <h3 className="mb-2 text-sm font-semibold">{t.guests.profile.historyTitle}</h3>
                {history.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                    {t.guests.profile.historyEmpty}
                  </p>
                ) : (
                  <ul className="divide-y overflow-hidden rounded-xl border">
                    {history.map((r) => (
                      <li key={r.id} className="space-y-2 px-3.5 py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span className="font-medium">{t.guests.profile.roomLabel(r.roomNumber)}</span>
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatMediumDate(new Date(`${r.checkIn}T00:00:00Z`))} → {formatMediumDate(new Date(`${r.checkOut}T00:00:00Z`))}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono text-muted-foreground">{reservationDisplayId(r.sequenceNumber)}</span>
                          <ChannelLabel channel={r.channel} />
                          <span className="ml-auto font-medium tabular-nums">{formatMoney(r.totalAmount)}</span>
                          <ReservationStatusBadge status={r.status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div></TabsContent>
                </div>
              </Tabs>

              <DialogFooter className="hidden sm:flex">
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  {t.guests.profile.editButton}
                </Button>
                <Button onClick={() => setSelectedId(null)}>{t.common.close}</Button>
              </DialogFooter>

              <GuestFormSheet
                guest={selected}
                open={editOpen}
                onOpenChange={(o) => setEditOpen(o)}
                onSaved={() => setSelectedId(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
      <GuestFormSheet guest={null} open={createOpen} onOpenChange={setCreateOpen} onSaved={() => undefined} />
    </div>
  );
}

function GuestFormSheet({
  guest,
  open,
  onOpenChange,
  onSaved,
}: {
  guest: GuestRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(guest?.fullName ?? "");
  const [email, setEmail] = useState(guest?.email ?? "");
  const [phone, setPhone] = useState(guest?.phone ?? "");
  const [country, setCountry] = useState(guest?.country ?? "");
  const [notes, setNotes] = useState(guest?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const result = await upsertGuestAction({
        id: guest?.id,
        fullName,
        email,
        phone,
        country,
        notes,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      onSaved();
      if (!guest) {
        setFullName("");
        setEmail("");
        setPhone("");
        setCountry("");
        setNotes("");
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{guest ? t.guests.editForm.title : "Новый гость"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 overflow-y-auto px-4 pb-6">
          <div className="space-y-1.5">
            <Label htmlFor="guest-name">{t.guests.editForm.fullName}</Label>
            <Input id="guest-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest-email">{t.dashboard.table.email}</Label>
            <Input id="guest-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest-phone">{t.dashboard.table.phone}</Label>
            <Input id="guest-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest-country">{t.guests.editForm.country}</Label>
            <Input id="guest-country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest-notes">{t.guests.editForm.notes}</Label>
            <Textarea id="guest-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={save} disabled={saving || !fullName.trim()}>
              {guest ? t.guests.editForm.saveGuest : "Добавить гостя"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
