"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/page-header";
import { RoomStatusBadge } from "@/components/shared/status-badge";
import { deleteRoomAction, setRoomStatusAction, upsertRoomAction } from "@/server/actions/rooms";
import { ROOM_STATUSES, type RoomStatus } from "@/lib/constants";
import type { RoomVM } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { MAX_NIGHTLY_PRICE, MIN_NIGHTLY_PRICE } from "@/lib/pricing";

type RoomDraft = {
  id?: string;
  number: string;
  floor: string;
  roomTypeName: string;
  capacity: string;
  basePrice: string;
  status: RoomStatus;
};

const EMPTY_ROOM: RoomDraft = {
  number: "",
  floor: "1",
  roomTypeName: "Стандарт",
  capacity: "2",
  basePrice: "25000",
  status: "AVAILABLE",
};

export function RoomsGrid({
  rooms,
  roomTypes,
  addButtonOnly = false,
}: {
  rooms: RoomVM[];
  roomTypes: string[];
  addButtonOnly?: boolean;
}) {
  const [draft, setDraft] = useState<RoomDraft | null>(null);
  const [deleteRoom, setDeleteRoom] = useState<RoomVM | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  function openCreate() {
    setDraft({ ...EMPTY_ROOM, roomTypeName: roomTypes[0] ?? EMPTY_ROOM.roomTypeName });
  }

  function openEdit(room: RoomVM) {
    setDraft({
      id: room.id,
      number: room.number,
      floor: String(room.floor),
      roomTypeName: room.roomTypeName,
      capacity: String(room.capacity ?? 1),
      basePrice: String(room.basePrice ?? 0),
      status: room.status,
    });
  }

  async function saveRoom() {
    if (!draft) return;
    setPending(true);
    const result = await upsertRoomAction(draft);
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(result.message);
    setDraft(null);
    router.refresh();
  }

  async function changeStatus(room: RoomVM, status: RoomStatus) {
    const result = await setRoomStatusAction({ roomId: room.id, status });
    if (!result.ok) return toast.error(result.error);
    toast.success(result.message);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteRoom) return;
    setPending(true);
    const result = await deleteRoomAction({ roomId: deleteRoom.id });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(result.message);
    setDeleteRoom(null);
    router.refresh();
  }

  const addButton = (
    <Button onClick={openCreate}>
      <Plus /> Добавить номер
    </Button>
  );

  return (
    <>
      {addButtonOnly ? addButton : rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="У вас пока нет номеров"
          description="Добавьте первый номер или квартиру. Он появится в календаре и бронированиях."
          action={<Button onClick={openCreate}><Plus /> Добавить первый номер</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rooms.map((room) => (
            <div key={room.id} className="group relative flex min-h-48 flex-col overflow-hidden rounded-xl border border-primary/10 bg-gradient-to-br from-card via-card to-primary/[0.035] p-4 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/65 via-chart-2/35 to-transparent" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
                    <BedDouble className="size-4" />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-base font-semibold" title={room.number}>{room.number}</div>
                    <div className="truncate text-xs text-muted-foreground">{room.roomTypeName}</div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Действия для номера ${room.number}`}><MoreVertical /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onSelect={() => openEdit(room)}><Pencil /> Редактировать</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {ROOM_STATUSES.map((status) => (
                      <DropdownMenuItem key={status} disabled={status === room.status} onSelect={() => void changeStatus(room, status)}>
                        {t.statuses.room[status]}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleteRoom(room)}><Trash2 /> Удалить</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-sm">
                <span className="text-muted-foreground">Этаж</span><span className="min-w-12 text-right tabular-nums">{room.floor}</span>
                <span className="text-muted-foreground">Вместимость</span><span className="min-w-12 text-right tabular-nums">{room.capacity ?? 1}</span>
                <span className="text-muted-foreground">Цена</span><span className="whitespace-nowrap text-right font-medium tabular-nums">{formatMoney(room.basePrice ?? 0)}</span>
                <span className="text-muted-foreground">Статус</span><span className="justify-self-end"><RoomStatusBadge status={room.status} /></span>
              </div>
              {room.guestTonight ? <p className="mt-auto truncate rounded-md bg-secondary/60 px-2 py-1 text-xs">{t.rooms.tonight(room.guestTonight)}</p> : null}
            </div>
          ))}
        </div>
      )}

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Редактировать номер" : "Добавить номер"}</DialogTitle>
            <DialogDescription>Номер принадлежит только текущему отелю.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Название или номер"><Input value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} placeholder="101 или Роза" /></Field>
              <Field label="Этаж"><Input type="number" value={draft.floor} onChange={(e) => setDraft({ ...draft, floor: e.target.value })} /></Field>
              <Field label="Тип номера">
                <Input list="room-type-options" value={draft.roomTypeName} onChange={(e) => setDraft({ ...draft, roomTypeName: e.target.value })} placeholder="Стандарт" />
                <datalist id="room-type-options">{roomTypes.map((name) => <option key={name} value={name} />)}</datalist>
              </Field>
              <Field label="Вместимость"><Input type="number" min="1" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} /></Field>
              <Field label="Цена за ночь, KZT">
                <Input type="number" min={MIN_NIGHTLY_PRICE} max={MAX_NIGHTLY_PRICE} step="500" value={draft.basePrice} onChange={(e) => setDraft({ ...draft, basePrice: e.target.value })} />
                <p className="text-xs text-muted-foreground">От 1 000 до 999 000 ₸</p>
              </Field>
              <Field label="Статус">
                <Select value={draft.status} onValueChange={(status: RoomStatus) => setDraft({ ...draft, status })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROOM_STATUSES.map((status) => <SelectItem key={status} value={status}>{t.statuses.room[status]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          ) : null}
          <DialogFooter showCloseButton>
            <Button onClick={() => void saveRoom()} disabled={pending}>{pending ? "Сохранение..." : "Сохранить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteRoom)} onOpenChange={(open) => !open && setDeleteRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить номер {deleteRoom?.number}?</DialogTitle>
            <DialogDescription>Удаление возможно только если у номера нет бронирований. Это действие нельзя отменить.</DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={pending}>{pending ? "Удаление..." : "Удалить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
