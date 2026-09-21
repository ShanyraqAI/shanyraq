"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Phone, Plus, Search, UserRound } from "lucide-react";
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
import { EmptyState } from "@/components/shared/page-header";
import { ChannelLabel, ReservationStatusBadge } from "@/components/shared/status-badge";
import { addGuestNoteAction, upsertGuestAction } from "@/server/actions/guests";
import { guestDisplayId, reservationDisplayId, type ReservationVM } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { formatMediumDate } from "@/lib/dates";
import { t } from "@/lib/i18n";

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
}

export function GuestsTable({ guests, reservations, initialSelectedId = null }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
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
            placeholder={t.guests.searchPlaceholder}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Добавить гостя</Button>
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
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
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
      )}

      {/* Details modal — full-screen drawer on mobile via responsive Dialog */}
      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
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

              <section className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Внутренние заметки</h3><Button type="button" size="sm" variant="outline" onClick={() => setNoteOpen((value) => !value)}><Plus className="size-3.5" /> Добавить заметку</Button></div>
                {noteOpen ? <div className="space-y-2"><Textarea aria-label="Новая заметка о госте" value={noteText} onChange={(event) => setNoteText(event.target.value)} maxLength={2000} rows={2} placeholder="Видно только сотрудникам отеля" /><Button type="button" size="sm" disabled={savingNote || !noteText.trim()} onClick={addNote}>Сохранить заметку</Button></div> : null}
                {selected.internalNotes.length ? <ul className="max-h-40 space-y-2 overflow-y-auto">{selected.internalNotes.map((note) => <li key={note.id} className="rounded-lg bg-secondary/40 p-2.5 text-sm"><p className="whitespace-pre-wrap">{note.content}</p><p className="mt-1 text-xs text-muted-foreground">{note.authorName} · {new Date(note.createdAt).toLocaleDateString("ru-RU")}</p></li>)}</ul> : <p className="text-xs text-muted-foreground">Заметок пока нет.</p>}
              </section>

              <div>
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
              </div>

              <DialogFooter>
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
