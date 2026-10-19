"use client";

import { ApartmentCover } from "./apartment-cover";
import { useEffect, useState } from "react";
import Link from "next/link";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/page-header";
import { RoomStatusBadge } from "@/components/shared/status-badge";
import { deleteRoomAction, upsertRoomAction } from "@/server/actions/rooms";
import { runOfflineAction } from "@/lib/offline/actions";
import { ROOM_STATUSES, type RoomStatus } from "@/lib/constants";
import type { RoomVM } from "@/lib/types";
import { t } from "@/lib/i18n";
import { MAX_NIGHTLY_PRICE, MIN_NIGHTLY_PRICE } from "@/lib/pricing";
import type { AppLocale } from "@/lib/locale";

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
  locale = "ru",
  highlightRoomId,
  typeDetails = [],
  editRoom,
}: {
  rooms: RoomVM[];
  roomTypes: string[];
  addButtonOnly?: boolean;
  locale?: AppLocale;
  highlightRoomId?: string;
  typeDetails?: Array<{ name: string; capacity: number; basePrice: number }>;
  editRoom?: RoomVM;
}) {
  const [draft, setDraft] = useState<RoomDraft | null>(null);
  const [initialDraft, setInitialDraft] = useState<RoomDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteRoom, setDeleteRoom] = useState<RoomVM | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const visibleRooms = rooms.filter((room) => `${room.number} ${room.roomTypeName}`.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale)));

  function openCreate() {
    const type = typeDetails[0];
    const next = { ...EMPTY_ROOM, roomTypeName: type?.name ?? roomTypes[0] ?? EMPTY_ROOM.roomTypeName,
      capacity: String(type?.capacity ?? EMPTY_ROOM.capacity), basePrice: String(type?.basePrice ?? EMPTY_ROOM.basePrice) };
    setDraft(next); setInitialDraft(next); setFormError(null);
  }

  function openEdit(room: RoomVM) {
    const next: RoomDraft = {
      id: room.id,
      number: room.number,
      floor: String(room.floor),
      roomTypeName: room.roomTypeName,
      capacity: String(room.capacity ?? 1),
      basePrice: String(room.basePrice ?? 0),
      status: room.status,
    };
    setDraft(next); setInitialDraft(next); setFormError(null);
  }

  const dirty = Boolean(draft && JSON.stringify(draft) !== JSON.stringify(initialDraft));
  const inherited = Boolean(draft && roomTypes.includes(draft.roomTypeName));
  function closeDraft() {
    if (pending) return;
    if (dirty && !window.confirm(locale === "kk" ? "Сақталмаған өзгерістерден бас тартасыз ба?" : "Отменить несохранённые изменения?")) return;
    setDraft(null); setFormError(null);
  }
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!highlightRoomId) return;
    document.getElementById(`room-${highlightRoomId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightRoomId]);

  async function saveRoom() {
    if (!draft) return;
    if (!draft.number.trim()) { setFormError(locale === "kk" ? "Пәтердің атауын көрсетіңіз" : "Укажите номер или название квартиры"); return; }
    setPending(true); setFormError(null);
    try {
      const result = await upsertRoomAction(draft);
      if (!result.ok) { setFormError(result.error); return; }
      toast.success(result.message); setDraft(null); router.refresh();
    } catch { setFormError(locale === "kk" ? "Сақтау сәтсіз аяқталды. Қайталап көріңіз." : "Не удалось сохранить. Повторите попытку."); }
    finally { setPending(false); }
  }

  async function changeStatus(room: RoomVM, status: RoomStatus) {
    const result = await runOfflineAction("room.status", `Статус · ${room.number}`, { roomId: room.id, status });
    if (!result.ok) return toast.error(result.error);
    toast.success(result.message);
    if (result.queued) return;
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
    editRoom ? <Button variant="outline" className="size-11 shrink-0" aria-label={locale === "kk" ? "Пәтерді өзгерту" : "Редактировать квартиру"} onClick={() => openEdit(editRoom)}><Pencil className="size-4" /></Button>
      : <Button className="min-h-11" onClick={openCreate}><Plus /> {locale === "kk" ? "Пәтер қосу" : "Добавить квартиру"}</Button>
  );

  return (
    <>
      {addButtonOnly ? addButton : rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title={locale === "kk" ? "Пәтерлер әлі жоқ" : "У вас пока нет квартир"}
          description={locale === "kk" ? "Күнтізбеде жұмыс істеу үшін бірінші пәтерді қосыңыз." : "Добавьте первую квартиру. Она появится в календаре и бронированиях."}
          action={<Button onClick={openCreate}><Plus /> Добавить первую квартиру</Button>}
        />
      ) : (
        <div className="space-y-4">
          <label className="block text-sm font-semibold">{locale === "kk" ? "Пәтерді іздеу" : "Поиск квартиры"}<Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={locale === "kk" ? "Атауы немесе түрі" : "Название или тип"} className="mt-2 min-h-11 max-w-lg text-base" /></label>
          <p role="status" className="text-sm text-muted-foreground">{locale === "kk" ? `Табылды: ${visibleRooms.length}` : `Найдено: ${visibleRooms.length}`}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleRooms.map((room) => (
            <div id={`room-${room.id}`} key={room.id} className={`sh-mobile-card group relative flex flex-col overflow-hidden ${highlightRoomId === room.id ? "ring-2 ring-primary" : ""}`}>
              <Link href={`/dashboard/rooms/${encodeURIComponent(room.id)}`} aria-label={locale === "kk" ? `${room.number} пәтерін ашу` : `Открыть квартиру ${room.number}`} className="block focus-visible:outline-2 focus-visible:outline-primary"><ApartmentCover photoId={room.photoId} name={room.number} restricted={room.photosRestricted} kk={locale === "kk"} /></Link>
              <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${room.status === "CLEANING" ? "bg-[#fff0d8] text-[#c6892c] ring-[#f3dfbd]" : room.status === "MAINTENANCE" || room.status === "OUT_OF_ORDER" ? "bg-[#fee7e4] text-[#df655d] ring-[#f3d1cd]" : room.guestTonight ? "bg-[#e5edfb] text-[#5087d7] ring-[#d5e1f6]" : "bg-[#ddf2ea] text-[#14836a] ring-[#cbe7dd]"}`}>
                    <BedDouble className="size-4" />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <Link href={`/dashboard/rooms/${encodeURIComponent(room.id)}`} className="flex min-h-11 items-center text-base font-semibold text-[#07866b]" title={room.number}><span className="break-words">{room.number}</span></Link>
                    <div className="truncate text-xs text-muted-foreground">{room.roomTypeName}</div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-11" aria-label={locale === "kk" ? `${room.number} әрекеттері` : `Действия для квартиры ${room.number}`}><MoreVertical /></Button>
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
                <span className="text-muted-foreground">{locale === "kk" ? "Қабат" : "Этаж"}</span><span className="min-w-12 text-right tabular-nums">{room.floor}</span>
                <span className="text-muted-foreground">{locale === "kk" ? "Сыйымдылық" : "Вместимость"}</span><span className="min-w-12 text-right tabular-nums">{room.capacity ?? 1}</span>
                <span className="text-muted-foreground">{locale === "kk" ? "Базалық баға / түн" : "Базовая цена / ночь"}</span><span className="whitespace-nowrap text-right font-medium tabular-nums">{new Intl.NumberFormat(locale === "kk" ? "kk-KZ" : "ru-RU", { style: "currency", currency: room.currency ?? "KZT", maximumFractionDigits: 2 }).format(room.basePrice ?? 0)}</span>
                <span className="text-muted-foreground">{locale === "kk" ? "Күйі" : "Статус"}</span><span className="justify-self-end"><RoomStatusBadge status={room.status} /></span>
              </div>
              {room.guestTonight ? <p className="mt-3 truncate rounded-md bg-secondary/60 px-2 py-2 text-sm">{t.rooms.tonight(room.guestTonight)}</p> : null}
              </div>
            </div>
          ))}
          </div>
          {!visibleRooms.length ? <p className="rounded-xl border border-dashed p-5 text-sm">{locale === "kk" ? "Ештеңе табылмады. Іздеуді өзгертіңіз." : "Ничего не найдено. Измените поисковый запрос."}</p> : null}
        </div>
      )}

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && closeDraft()}>
        <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden bg-background p-4 max-sm:inset-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:pt-[max(env(safe-area-inset-top),16px)] max-sm:[&>button]:size-11 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">{draft?.id ? `Квартира ${draft.number}` : "Новая квартира"}</DialogTitle>
            <DialogDescription>{draft?.id ? "Измените основные параметры и сохраните обновления." : "Добавьте квартиру, чтобы открыть её в календаре и бронированиях."}</DialogDescription>
          </DialogHeader>
          {draft ? (
            <fieldset disabled={pending} className="grid min-h-0 gap-4 overflow-y-auto pb-4 sm:grid-cols-2">
              <Field label={locale === "kk" ? "Пәтердің нөмірі немесе атауы" : "Номер или название квартиры"}><Input value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} placeholder="Например, 101" className="h-11 rounded-xl bg-white" /></Field>
              <Field label="Этаж"><Input type="number" inputMode="numeric" value={draft.floor} onChange={(e) => setDraft({ ...draft, floor: e.target.value })} /></Field>
              <Field label="Тип квартиры">
                <Input list="room-type-options" value={draft.roomTypeName} onChange={(e) => {
                  const type = typeDetails.find((item) => item.name === e.target.value);
                  setDraft({ ...draft, roomTypeName: e.target.value, ...(type ? { capacity: String(type.capacity), basePrice: String(type.basePrice) } : {}) });
                }} placeholder="Стандарт" className="h-11 rounded-xl bg-white" />
                <datalist id="room-type-options">{roomTypes.map((name) => <option key={name} value={name} />)}</datalist>
              </Field>
              <Field label="Вместимость"><Input type="number" inputMode="numeric" min="1" disabled={inherited} value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} /></Field>
              <Field label="Цена за ночь, KZT">
                <Input type="number" inputMode="decimal" disabled={inherited} min={MIN_NIGHTLY_PRICE} max={MAX_NIGHTLY_PRICE} step="500" value={draft.basePrice} onChange={(e) => setDraft({ ...draft, basePrice: e.target.value })} />
                <p className="text-xs text-muted-foreground">От 1 000 до 999 000 ₸</p>
              </Field>
              <Field label="Статус">
                <Select value={draft.status} onValueChange={(status: RoomStatus) => setDraft({ ...draft, status })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROOM_STATUSES.map((status) => <SelectItem key={status} value={status}>{t.statuses.room[status]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              {inherited ? <p className="text-sm text-muted-foreground sm:col-span-2">{locale === "kk" ? "Баға мен сыйымдылық пәтер түрінен алынады. Бұл нысанда олар өзгермейді." : "Цена и вместимость наследуются от типа квартиры и здесь не меняются."} <Link className="inline-flex min-h-11 items-center font-semibold underline" href="/dashboard/rates">{locale === "kk" ? "Бағаларды ашу" : "Открыть цены"}</Link></p> : null}
              {formError ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{formError}</p> : null}
            </fieldset>
          ) : null}
          <DialogFooter className="shrink-0 -mx-4 -mb-4 mt-0 bg-background pb-[max(env(safe-area-inset-bottom),16px)] sm:mx-0 sm:mb-0 sm:bg-transparent sm:p-0">
            <Button variant="ghost" className="min-h-11" onClick={closeDraft} disabled={pending}>{locale === "kk" ? "Бас тарту" : "Отмена"}</Button>
            <Button className="min-h-12 w-full rounded-xl sm:w-auto" onClick={() => void saveRoom()} disabled={pending}>{pending ? (locale === "kk" ? "Сақталуда…" : "Сохраняем…") : draft?.id ? (locale === "kk" ? "Сақтау" : "Сохранить") : (locale === "kk" ? "Пәтер жасау" : "Создать квартиру")}</Button>
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
  return <label className="block space-y-1.5"><span className="block text-sm font-semibold">{label}</span>{children}</label>;
}
