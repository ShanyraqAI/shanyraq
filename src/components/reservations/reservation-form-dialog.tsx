"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createReservationAction, updateReservationAction } from "@/server/actions/reservations";
import type { GuestVM, RatePlanVM, RoomVM } from "@/lib/types";
import { CHANNEL_CODES } from "@/lib/constants";
import { formatMoney } from "@/lib/utils";

export interface ReservationFormProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: RoomVM[];
  ratePlans: RatePlanVM[];
  guests: GuestVM[];
  hotelCurrency: string;
  initial?: {
    id?: string;
    guestId?: string;
    roomId?: string;
    checkIn?: string;
    checkOut?: string;
    adults?: number;
    children?: number;
    ratePlanId?: string;
    sourceChannel?: string;
    notes?: string | null;
  };
}

const NEW_GUEST = "__new__";

function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ReservationFormDialog({
  mode,
  open,
  onOpenChange,
  rooms,
  ratePlans,
  guests,
  initial,
}: ReservationFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [guestChoice, setGuestChoice] = useState<string>(
    initial?.guestId ?? (mode === "create" ? guests[0]?.id ?? NEW_GUEST : ""),
  );
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [roomId, setRoomId] = useState(initial?.roomId ?? rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? todayISO());
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? addDaysISO(todayISO(), 2));
  const [adults, setAdults] = useState(String(initial?.adults ?? 2));
  const [children, setChildren] = useState(String(initial?.children ?? 0));
  const [channel, setChannel] = useState(initial?.sourceChannel ?? "direct");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const plansForType = useMemo(
    () => ratePlans.filter((p) => p.roomTypeId === selectedRoom?.roomTypeId),
    [ratePlans, selectedRoom],
  );
  const [planId, setPlanId] = useState(initial?.ratePlanId ?? "");
  const effectivePlanId =
    plansForType.find((p) => p.id === planId)?.id ?? plansForType[0]?.id ?? "";

  const nights = Math.max(
    1,
    Math.round(
      (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / 86_400_000,
    ),
  );
  const selectedPlan = ratePlans.find((p) => p.id === effectivePlanId);
  const estimate = (selectedPlan?.basePrice ?? 0) * nights;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === "create") {
        const payload = {
          guestId: guestChoice === NEW_GUEST ? undefined : guestChoice,
          guestName: guestChoice === NEW_GUEST ? newName : undefined,
          guestEmail: guestChoice === NEW_GUEST ? newEmail : "",
          roomId,
          checkIn,
          checkOut,
          adults: Number(adults),
          children: Number(children),
          ratePlanId: effectivePlanId,
          sourceChannel: channel as (typeof CHANNEL_CODES)[number],
          notes: notes || undefined,
        };
        const result = await createReservationAction(payload);
        if (!result.ok) {
          toast.error(result.error ?? "Could not create reservation");
          return;
        }
        toast.success(result.message ?? "Reservation created");
      } else {
        const result = await updateReservationAction({
          id: initial!.id,
          guestId: guestChoice === NEW_GUEST ? undefined : guestChoice,
          guestName: guestChoice === NEW_GUEST ? newName : undefined,
          guestEmail: guestChoice === NEW_GUEST ? newEmail : "",
          roomId,
          checkIn,
          checkOut,
          adults: Number(adults),
          children: Number(children),
          ratePlanId: effectivePlanId,
          notes: notes || undefined,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Could not update reservation");
          return;
        }
        toast.success(result.message ?? "Reservation updated");
      }
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create reservation" : "Edit reservation"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Book a room directly. Inventory and availability are checked automatically."
              : "Update stay details. Changes re-price the booking from the current rate calendar."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Guest */}
          <div className="space-y-1.5">
            <Label>Guest</Label>
            {guests.length > 0 && (
              <Select value={guestChoice} onValueChange={setGuestChoice}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select guest" />
                </SelectTrigger>
                <SelectContent>
                  {guests.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.fullName}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_GUEST}>+ New guest…</SelectItem>
                </SelectContent>
              </Select>
            )}
            {guestChoice === NEW_GUEST && (
              <div className="mt-2 grid gap-2">
                <Input
                  placeholder="Full name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
                <Input
                  placeholder="Email (optional)"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Room */}
          <div className="space-y-1.5">
            <Label>Room</Label>
            <Select
              value={roomId}
              onValueChange={(v) => {
                setRoomId(v);
                setPlanId("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id} disabled={r.status === "OUT_OF_ORDER"}>
                    {r.number} · {r.roomTypeName} ({r.status.toLowerCase().replace("_", " ")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="checkin">Check-in</Label>
              <Input
                id="checkin"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkout">Check-out</Label>
              <Input
                id="checkout"
                type="date"
                value={checkOut}
                min={addDaysISO(checkIn, 1)}
                onChange={(e) => setCheckOut(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Occupancy + plan */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Adults</Label>
              <Select value={adults} onValueChange={setAdults}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Children</Label>
              <Select value={children} onValueChange={setChildren}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 space-y-1.5">
              <Label>Source</Label>
              {mode === "create" ? (
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_CODES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c === "booking" ? "Booking.com" : c.charAt(0).toUpperCase() + c.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="pt-2 text-sm text-muted-foreground">unchanged</div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Rate plan</Label>
            <Select value={effectivePlanId} onValueChange={setPlanId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select rate plan" />
              </SelectTrigger>
              <SelectContent>
                {plansForType.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.basePrice)}/night
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoom && plansForType.length === 0 && (
              <p className="text-xs text-destructive">No rate plans configured for this room type.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="res-notes">Notes</Label>
            <Textarea
              id="res-notes"
              placeholder="Special requests, arrival time…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {nights} night{nights === 1 ? "" : "s"} × {selectedPlan?.name ?? "—"}
            </span>
            <span className="font-semibold tabular-nums">≈ {formatMoney(estimate)}</span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !effectivePlanId}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {mode === "create" ? "Create reservation" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
