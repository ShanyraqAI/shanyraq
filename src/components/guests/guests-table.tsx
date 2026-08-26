"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Phone, Search, UserRound } from "lucide-react";
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
import { upsertGuestAction } from "@/server/actions/guests";
import type { ReservationVM } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { formatMediumDate } from "@/lib/dates";
import { t } from "@/lib/i18n";

export interface GuestRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  notes: string | null;
  reservationCount: number;
  lastStay: string | null; // ISO date of most recent check-in
  lastChannel: string | null;
}

interface Props {
  guests: GuestRow[];
  reservations: ReservationVM[]; // full list to derive history per guest
}

export function GuestsTable({ guests, reservations }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.fullName.toLowerCase().includes(q) ||
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
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.guests.searchPlaceholder}
          className="pl-8"
        />
      </div>

      {guests.length === 0 ? (
        <EmptyState icon={UserRound} title={t.guests.emptyTitle} description={t.guests.emptyDescription} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
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
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
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
                  {t.guests.profile.subtitle}
                </DialogDescription>
              </DialogHeader>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <Mail className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{selected.email ?? "—"}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <Phone className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{selected.phone ?? "—"}</span>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <dt className="text-xs text-muted-foreground">{t.guests.profile.country}</dt>
                  <dd className="mt-0.5 font-medium">{selected.country ?? "—"}</dd>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <dt className="text-xs text-muted-foreground">{t.guests.profile.totalStays}</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">{history.length}</dd>
                </div>
              </dl>

              {selected.notes ? (
                <div className="rounded-lg border border-dashed bg-secondary/30 p-3 text-sm text-muted-foreground">
                  “{selected.notes}”
                </div>
              ) : null}

              <div>
                <h3 className="mb-2 text-sm font-semibold">{t.guests.profile.historyTitle}</h3>
                {history.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                    {t.guests.profile.historyEmpty}
                  </p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {history.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">#{r.id.slice(-8).toUpperCase()}</span>
                        <span className="font-medium">
                          {t.guests.profile.roomLabel(r.roomNumber)}
                        </span>
                        <span className="whitespace-nowrap text-muted-foreground">
                          {formatMediumDate(new Date(`${r.checkIn}T00:00:00Z`))} → {formatMediumDate(new Date(`${r.checkOut}T00:00:00Z`))}
                        </span>
                        <ChannelLabel channel={r.channel} className="ml-auto" />
                        <span className="tabular-nums">{formatMoney(r.totalAmount)}</span>
                        <ReservationStatusBadge status={r.status} />
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

              <GuestEditDialog
                guest={selected}
                open={editOpen}
                onOpenChange={(o) => setEditOpen(o)}
                onSaved={() => setSelectedId(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GuestEditDialog({
  guest,
  open,
  onOpenChange,
  onSaved,
}: {
  guest: GuestRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(guest.fullName);
  const [email, setEmail] = useState(guest.email ?? "");
  const [phone, setPhone] = useState(guest.phone ?? "");
  const [country, setCountry] = useState(guest.country ?? "");
  const [notes, setNotes] = useState(guest.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const result = await upsertGuestAction({
        id: guest.id,
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
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t.guests.editForm.title}</SheetTitle>
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
              {t.guests.editForm.saveGuest}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
