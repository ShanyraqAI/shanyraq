"use client";

import { useMemo, useState } from "react";
import { GUEST_DETAIL_PAGE_SIZE, guestPageUrl } from "@/lib/guests/pagination";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  ChevronRight,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  StickyNote,
  UserRound,
} from "lucide-react";
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
import {
  ChannelLabel,
  ReservationStatusBadge,
} from "@/components/shared/status-badge";
import { runOfflineAction } from "@/lib/offline/actions";
import {
  guestDisplayId,
  reservationDisplayId,
  type ReservationVM,
} from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { formatMediumDate } from "@/lib/dates";
import { t } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";
import { whatsappHref } from "@/lib/whatsapp";

export interface GuestRow {
  id: string;
  sequenceNumber: number | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  notes: string | null;
  internalNotes: Array<{
    id: string;
    content: string;
    createdAt: string;
    authorName: string;
  }>;
  reservationCount: number;
  lastStay: string | null; // ISO date of most recent check-in
  lastChannel: string | null;
}

interface Props {
  guests: GuestRow[];
  reservations: ReservationVM[]; // one bounded page for the selected guest
  initialSelectedId?: string | null;
  locale?: AppLocale;
  detailTab?: "notes" | "stays";
  serverQuery?: string;
  page?: number;
  staysPage?: number;
  notesPage?: number;
  historyTotal?: number;
  notesTotal?: number;
}

export function GuestsTable({
  guests,
  reservations,
  initialSelectedId = null,
  locale = "ru",
  serverQuery = "",
  page = 1,
  staysPage = 1,
  notesPage = 1,
  historyTotal = 0,
  notesTotal = 0,
  detailTab = "stays",
}: Props) {
  const kk = locale === "kk";
  const [query, setQuery] = useState(serverQuery);
  const selectedId = initialSelectedId;
  function setSelectedId(id: string | null) {
    router.push(guestPageUrl({ page, q: serverQuery, guest: id }));
  }
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
      const result = await runOfflineAction("guest.note", "Заметка о госте", {
        guestId: selectedId,
        content: noteText,
      });
      if (!result.ok) return toast.error(result.error);
      setNoteText("");
      setNoteOpen(false);
      toast.success(result.message);
      if (result.queued) return;
      router.refresh();
    } finally {
      setSavingNote(false);
    }
  }

  const filtered = guests;

  const selected = guests.find((g) => g.id === selectedId) ?? null;
  const selectedWhatsApp = selected
    ? whatsappHref(
        selected.phone,
        kk
          ? `Сәлеметсіз бе, ${selected.fullName}!`
          : `Здравствуйте, ${selected.fullName}!`,
      )
    : null;
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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            router.push(
              guestPageUrl({ q: query.trim().slice(0, 160), page: 1 }),
            );
          }}
          className="relative w-full max-w-sm"
        >
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              kk
                ? "Аты, телефоны немесе ЖСН бойынша іздеу"
                : t.guests.searchPlaceholder
            }
            className="h-11 rounded-xl border-[#e7e9e0] bg-white pl-8 text-xs sm:h-9 sm:rounded-md"
          />
          <button
            type="submit"
            className="mt-2 min-h-11 rounded-xl border px-3 text-sm"
          >
            {kk ? "Іздеу" : "Найти"}
          </button>
        </form>
        <div className="hidden items-center gap-2 sm:flex">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> {kk ? "Қонақ қосу" : "Добавить гостя"}
          </Button>
        </div>
      </div>

      {guests.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title={t.guests.emptyTitle}
          description="Добавьте гостя вручную или создайте бронирование — карточка останется в базе вашего отеля."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Добавить гостя
            </Button>
          }
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
                  <TableHead className="text-right">
                    {t.guests.table.reservations}
                  </TableHead>
                  <TableHead>{t.guests.table.lastStay}</TableHead>
                  <TableHead>{t.guests.table.lastSource}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((g) => (
                  <TableRow
                    key={g.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(g.id)}
                  >
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {guestDisplayId(g.sequenceNumber)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {g.fullName
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span className="font-medium">{g.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {g.email ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {g.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {g.reservationCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {g.lastStay
                        ? formatMediumDate(new Date(`${g.lastStay}T00:00:00Z`))
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {g.lastChannel ? (
                        <ChannelLabel channel={g.lastChannel} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-muted-foreground"
                    >
                      {t.guests.searchEmpty}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2 sm:hidden">
            <div className="flex items-center justify-between">
              <h2 className="sh-mobile-section-title">
                {kk ? "Соңғылар" : "Недавние"}
              </h2>
              <span className="text-[10px] font-bold text-[#07866b]">
                {kk ? "Сегменттер" : "Сегменты"}
              </span>
            </div>
            {filtered.map((guest, index) => (
              <button
                key={guest.id}
                type="button"
                onClick={() => setSelectedId(guest.id)}
                className="sh-mobile-card flex min-h-[68px] w-full items-center gap-3 p-3 text-left"
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-extrabold ${index % 4 === 0 ? "bg-[#ddf2ea] text-[#14846b]" : index % 4 === 1 ? "bg-[#e4edfb] text-[#5187d7]" : index % 4 === 2 ? "bg-[#fbefd8] text-[#c2872e]" : "bg-[#fbe3e1] text-[#df645d]"}`}
                >
                  {guest.sequenceNumber ?? index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-extrabold text-[#303c35]">
                    {guest.fullName}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] text-[#969c95]">
                    {guest.phone ??
                      guest.email ??
                      guestDisplayId(guest.sequenceNumber)}
                  </span>
                  <span className="mt-1 block text-[9px] text-[#777f78]">
                    {guest.reservationCount} {kk ? "сапар" : "поездок"}
                    {guest.reservationCount > 1 ? (
                      <b className="ml-1 text-[#07866b]">
                        · {kk ? "Тұрақты қонақ" : "Постоянный гость"}
                      </b>
                    ) : null}
                  </span>
                </span>
                <span className="text-[#adb2ac]">›</span>
              </button>
            ))}
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {kk ? "Ештеңе табылмады." : t.guests.searchEmpty}
              </p>
            ) : null}
            <Button
              onClick={() => setCreateOpen(true)}
              className="sh-mobile-primary mt-2 w-full"
            >
              <Plus className="size-4" />
              {kk ? "Қонақ қосу" : "Добавить гостя"}
            </Button>
          </div>
        </>
      )}

      {/* Details modal — full-screen drawer on mobile via responsive Dialog */}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(o) => !o && setSelectedId(null)}
      >
        <DialogContent className="flex max-h-[90dvh] flex-col gap-3 overflow-hidden p-4 max-sm:inset-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:bg-[#f8f8f4] max-sm:p-4 max-sm:pt-[max(env(safe-area-inset-top),16px)] max-sm:pb-0 max-sm:ring-0 sm:max-w-xl sm:p-6">
          {selected && (
            <>
              <DialogHeader className="max-sm:text-left">
                <DialogTitle className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#ddf2ea] text-sm font-extrabold text-[#14846b] sm:size-9 sm:bg-primary/10 sm:text-primary">
                    {initials(selected.fullName)}
                  </span>
                  <span className="min-w-0 truncate max-sm:text-xl max-sm:font-extrabold max-sm:tracking-tight max-sm:text-[#17221e]">
                    {selected.fullName}
                  </span>
                </DialogTitle>
                <DialogDescription className="max-sm:text-[#8b9189]">
                  {guestDisplayId(selected.sequenceNumber)} ·{" "}
                  {kk ? `${historyTotal} сапар` : tripsLabel(historyTotal)}
                  {selected.reservationCount > 1 ? (
                    <b className="ml-1 text-[#07866b]">
                      · {kk ? "Тұрақты қонақ" : "Постоянный гость"}
                    </b>
                  ) : null}
                </DialogDescription>
              </DialogHeader>

              {selected.phone ? (
                <div className="hidden flex-wrap gap-2 sm:flex">
                  <Button asChild variant="outline" size="sm">
                    <a href={`tel:${selected.phone}`}>
                      <Phone className="size-4" />
                      {kk ? "Қоңырау шалу" : "Позвонить"}
                    </a>
                  </Button>
                  {selectedWhatsApp ? (
                    <Button
                      asChild
                      size="sm"
                      className="bg-[#25D366] text-white hover:bg-[#1fb75a]"
                    >
                      <a
                        href={selectedWhatsApp}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="size-4" />
                        WhatsApp
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2 sm:hidden">
                <a
                  href={selected.phone ? `tel:${selected.phone}` : undefined}
                  aria-disabled={!selected.phone}
                  className="sh-mobile-card flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-bold text-[#16826a] aria-disabled:pointer-events-none aria-disabled:opacity-45"
                >
                  <Phone className="size-4" />
                  {kk ? "Қоңырау" : "Позвонить"}
                </a>
                <a
                  href={selectedWhatsApp ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!selectedWhatsApp}
                  className="sh-mobile-card flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-bold text-[#16826a] aria-disabled:pointer-events-none aria-disabled:opacity-45"
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="sh-mobile-card flex min-h-14 flex-col items-center justify-center gap-1 text-[9px] font-bold text-[#16826a]"
                >
                  <Pencil className="size-4" />
                  {kk ? "Өзгерту" : "Изменить"}
                </button>
              </div>

              <Tabs
                defaultValue={detailTab}
                className="min-h-0 flex-1 overflow-hidden"
                key={selected.id}
              >
                <TabsList className="grid w-full shrink-0 grid-cols-3 max-sm:h-11 max-sm:rounded-xl max-sm:bg-[#eceee6] max-sm:p-1 max-sm:[&>button]:rounded-lg max-sm:[&>button]:text-xs max-sm:[&>button]:font-bold max-sm:[&>button[data-state=active]]:bg-white max-sm:[&>button[data-state=active]]:text-[#07866b]">
                  <TabsTrigger value="stays">
                    {kk ? "Тұрулар" : "Проживания"}
                  </TabsTrigger>
                  <TabsTrigger value="notes">
                    {kk ? "Ескертпелер" : "Заметки"}
                  </TabsTrigger>
                  <TabsTrigger value="details">
                    {kk ? "Деректер" : "Данные"}
                  </TabsTrigger>
                </TabsList>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-3 max-sm:pb-4">
                  <TabsContent value="details" className="space-y-3">
                    <dl className="grid overflow-hidden rounded-xl border bg-secondary/15 max-sm:rounded-2xl max-sm:border max-sm:border-[#e2e4da] max-sm:bg-white max-sm:shadow-[0_5px_18px_rgb(38_61_51/0.045)] max-sm:border-0 max-sm:bg-white sm:grid-cols-2">
                      <div className="min-w-0 border-b p-3.5 max-sm:border-[#f0f1eb] sm:border-r">
                        <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="size-3.5" /> Email
                        </dt>
                        <dd className="mt-1 truncate text-sm font-medium max-sm:font-bold max-sm:text-[#303d36]">
                          {selected.email ?? "—"}
                        </dd>
                      </div>
                      <div className="min-w-0 border-b p-3.5 max-sm:border-[#f0f1eb]">
                        <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="size-3.5" />{" "}
                          {kk ? "Телефон" : "Телефон"}
                        </dt>
                        <dd className="mt-1 truncate text-sm font-medium max-sm:font-bold max-sm:text-[#303d36]">
                          {selected.phone ?? "—"}
                        </dd>
                      </div>
                      <div className="p-3.5 max-sm:border-b max-sm:border-[#f0f1eb] sm:border-r">
                        <dt className="text-xs text-muted-foreground">
                          {t.guests.profile.country}
                        </dt>
                        <dd className="mt-1 text-sm font-medium max-sm:font-bold max-sm:text-[#303d36]">
                          {selected.country ?? "—"}
                        </dd>
                      </div>
                      <div className="p-3.5">
                        <dt className="text-xs text-muted-foreground">
                          {t.guests.profile.totalStays}
                        </dt>
                        <dd className="mt-1 text-sm font-medium tabular-nums max-sm:font-bold max-sm:text-[#303d36]">
                          {historyTotal}
                        </dd>
                      </div>
                    </dl>

                    {selected.notes ? (
                      <div className="rounded-lg border border-dashed bg-secondary/30 p-3 text-sm text-muted-foreground max-sm:rounded-2xl max-sm:border-[#cfe5dc] max-sm:bg-[#e7f4ef] max-sm:text-[#19755f]">
                        “{selected.notes}”
                      </div>
                    ) : null}
                  </TabsContent>
                  <TabsContent value="notes">
                    <section className="space-y-2">
                      <DetailPages
                        current={notesPage}
                        total={notesTotal}
                        url={(p) =>
                          guestPageUrl({
                            page,
                            q: serverQuery,
                            guest: selectedId,
                            stays: staysPage,
                            notes: p,
                            tab: "notes",
                          })
                        }
                      />
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold max-sm:text-[0.92rem] max-sm:font-extrabold max-sm:text-[#26352f]">
                          {kk ? "Ішкі ескертпелер" : "Внутренние заметки"}
                        </h3>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="max-sm:rounded-full max-sm:border-[#07866b]/30 max-sm:text-[#07866b]"
                          onClick={() => setNoteOpen((value) => !value)}
                        >
                          <Plus className="size-3.5" />{" "}
                          {kk ? "Қосу" : "Добавить заметку"}
                        </Button>
                      </div>
                      {noteOpen ? (
                        <div className="space-y-2">
                          <Textarea
                            aria-label={
                              kk
                                ? "Қонақ туралы жаңа ескертпе"
                                : "Новая заметка о госте"
                            }
                            value={noteText}
                            onChange={(event) =>
                              setNoteText(event.target.value)
                            }
                            maxLength={2000}
                            rows={2}
                            className="max-sm:rounded-2xl max-sm:border max-sm:border-[#e2e4da] max-sm:bg-white max-sm:shadow-[0_5px_18px_rgb(38_61_51/0.045)] max-sm:border-0 max-sm:text-sm"
                            placeholder={
                              kk
                                ? "Тек қызметкерлерге көрінеді"
                                : "Видно только сотрудникам"
                            }
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="max-sm:h-11 max-sm:w-full max-sm:rounded-xl max-sm:bg-[#07866b] max-sm:font-bold"
                            disabled={savingNote || !noteText.trim()}
                            onClick={addNote}
                          >
                            {kk ? "Ескертпені сақтау" : "Сохранить заметку"}
                          </Button>
                        </div>
                      ) : null}
                      {selected.internalNotes.length ? (
                        <>
                          <ul className="space-y-2">
                            {selected.internalNotes
                              .slice(0, showAllNotes ? undefined : 3)
                              .map((note) => (
                                <li
                                  key={note.id}
                                  className="rounded-lg bg-secondary/40 p-2.5 text-sm max-sm:rounded-2xl max-sm:border max-sm:border-[#e2e4da] max-sm:bg-white max-sm:shadow-[0_5px_18px_rgb(38_61_51/0.045)] max-sm:p-3.5"
                                >
                                  <p className="whitespace-pre-wrap max-sm:text-[#303d36]">
                                    {note.content}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {note.authorName} ·{" "}
                                    {new Date(
                                      note.createdAt,
                                    ).toLocaleDateString("ru-RU")}
                                  </p>
                                </li>
                              ))}
                          </ul>
                          {selected.internalNotes.length > 3 ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowAllNotes((value) => !value)}
                            >
                              {showAllNotes
                                ? kk
                                  ? "Жию"
                                  : "Свернуть"
                                : `${kk ? "Барлығын көрсету" : "Показать все"} · ${selected.internalNotes.length}`}
                            </Button>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground max-sm:rounded-2xl max-sm:border max-sm:border-[#e2e4da] max-sm:bg-white max-sm:shadow-[0_5px_18px_rgb(38_61_51/0.045)] max-sm:py-6 max-sm:text-center">
                          {kk ? "Әзірге ескертпе жоқ." : "Заметок пока нет."}
                        </p>
                      )}
                    </section>
                  </TabsContent>

                  <TabsContent value="stays">
                    <div>
                      <DetailPages
                        current={staysPage}
                        total={historyTotal}
                        url={(p) =>
                          guestPageUrl({
                            page,
                            q: serverQuery,
                            guest: selectedId,
                            stays: p,
                            notes: notesPage,
                            tab: "stays",
                          })
                        }
                      />
                      <h3 className="mb-2 text-sm font-semibold max-sm:text-[0.92rem] max-sm:font-extrabold max-sm:text-[#26352f]">
                        {kk ? "Сапарлар тарихы" : t.guests.profile.historyTitle}
                      </h3>
                      {history.length === 0 ? (
                        <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground max-sm:rounded-2xl max-sm:border max-sm:border-[#e2e4da] max-sm:bg-white max-sm:shadow-[0_5px_18px_rgb(38_61_51/0.045)] max-sm:border-solid">
                          {t.guests.profile.historyEmpty}
                        </p>
                      ) : (
                        <ul className="divide-y overflow-hidden rounded-xl border max-sm:space-y-2 max-sm:divide-y-0 max-sm:rounded-none max-sm:border-0">
                          {history.map((r) => (
                            <li
                              key={r.id}
                              className="space-y-2 px-3.5 py-3 text-sm max-sm:rounded-2xl max-sm:border max-sm:border-[#e2e4da] max-sm:bg-white max-sm:shadow-[0_5px_18px_rgb(38_61_51/0.045)]"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                <span className="font-medium max-sm:font-extrabold max-sm:text-[#2d3a33]">
                                  {t.guests.profile.roomLabel(r.roomNumber)}
                                </span>
                                <span className="whitespace-nowrap text-xs text-muted-foreground">
                                  {formatMediumDate(
                                    new Date(`${r.checkIn}T00:00:00Z`),
                                  )}{" "}
                                  →{" "}
                                  {formatMediumDate(
                                    new Date(`${r.checkOut}T00:00:00Z`),
                                  )}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-mono text-muted-foreground">
                                  {reservationDisplayId(r.sequenceNumber)}
                                </span>
                                <ChannelLabel channel={r.channel} />
                                <span className="ml-auto font-medium tabular-nums max-sm:font-extrabold max-sm:text-[#2f3b35]">
                                  {formatMoney(r.totalAmount)}
                                </span>
                                <ReservationStatusBadge status={r.status} />
                              </div>
                              {r.notes ? (
                                <p className="flex items-start gap-1.5 rounded-lg bg-[#e7f4ef] px-2.5 py-2 text-xs text-[#19755f]">
                                  <StickyNote className="mt-0.5 size-3.5 shrink-0" />
                                  <span className="whitespace-pre-wrap">
                                    {r.notes}
                                  </span>
                                </p>
                              ) : null}
                              <Link
                                href={`/dashboard/reservations/${r.id}`}
                                className="hidden items-center gap-0.5 text-[11px] font-bold text-[#07866b] max-sm:inline-flex"
                              >
                                {kk ? "Броньды ашу" : "Открыть бронь"}
                                <ChevronRight className="size-3.5" />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>

              <DialogFooter className="hidden sm:flex">
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  {t.guests.profile.editButton}
                </Button>
                <Button onClick={() => setSelectedId(null)}>
                  {t.common.close}
                </Button>
              </DialogFooter>
              <div className="-mx-4 grid grid-cols-2 gap-2 border-t border-[#e6e8df] bg-white/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="sh-mobile-card flex min-h-12 items-center justify-center text-sm font-bold text-[#536059]"
                >
                  {t.common.close}
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="sh-mobile-primary flex min-h-12 items-center justify-center gap-2"
                >
                  <Pencil className="size-4" />
                  {kk ? "Өзгерту" : "Редактировать"}
                </button>
              </div>

              <GuestFormSheet
                guest={selected}
                open={editOpen}
                onOpenChange={(o) => setEditOpen(o)}
                onSaved={() => setSelectedId(null)}
                locale={locale}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
      <GuestFormSheet
        guest={null}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => undefined}
        locale={locale}
      />
    </div>
  );
}

function tripsLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "поездка"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "поездки"
        : "поездок";
  return `${count} ${word}`;
}

function initials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function GuestFormSheet({
  guest,
  open,
  onOpenChange,
  onSaved,
  locale = "ru",
}: {
  guest: GuestRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  locale?: AppLocale;
}) {
  const router = useRouter();
  const kk = locale === "kk";
  const [fullName, setFullName] = useState(guest?.fullName ?? "");
  const [email, setEmail] = useState(guest?.email ?? "");
  const [phone, setPhone] = useState(guest?.phone ?? "");
  const [country, setCountry] = useState(guest?.country ?? "");
  const [notes, setNotes] = useState(guest?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const fieldClass =
    "max-sm:h-12 max-sm:rounded-xl max-sm:border-[#e2e4da] max-sm:bg-white max-sm:px-3 max-sm:text-sm max-sm:shadow-none max-sm:focus-visible:border-[#07866b] max-sm:focus-visible:ring-[#07866b]/15";
  const labelClass = "max-sm:text-xs max-sm:font-bold max-sm:text-[#4b5650]";

  async function save() {
    setSaving(true);
    try {
      const result = await runOfflineAction(
        "guest.upsert",
        `${guest ? "Изменение гостя" : "Новый гость"} · ${fullName}`,
        {
          id: guest?.id,
          fullName,
          email,
          phone,
          country,
          notes,
        },
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      if (result.queued) return;
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
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto max-sm:data-[side=right]:w-full max-sm:data-[side=right]:max-w-none max-sm:bg-[#f8f8f4] max-sm:pt-[max(env(safe-area-inset-top),8px)] sm:max-w-md"
      >
        <SheetHeader className="max-sm:pb-2">
          <SheetTitle className="max-sm:text-xl max-sm:font-extrabold max-sm:tracking-tight max-sm:text-[#17221e]">
            {guest
              ? kk
                ? "Қонақты өзгерту"
                : t.guests.editForm.title
              : kk
                ? "Жаңа қонақ"
                : "Новый гость"}
          </SheetTitle>
          <p className="hidden text-xs text-[#8b9189] max-sm:block">
            {guest
              ? guestDisplayId(guest.sequenceNumber)
              : kk
                ? "Карточка қонақтар базасында сақталады"
                : "Карточка сохранится в базе гостей"}
          </p>
        </SheetHeader>
        <div className="flex flex-1 flex-col space-y-4 overflow-y-auto px-4 pb-6">
          <div className="space-y-1.5">
            <Label htmlFor="guest-name" className={labelClass}>
              {t.guests.editForm.fullName}
            </Label>
            <Input
              id="guest-name"
              className={fieldClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest-phone" className={labelClass}>
              {t.dashboard.table.phone}
            </Label>
            <Input
              id="guest-phone"
              className={fieldClass}
              inputMode="tel"
              placeholder="+7 700 000 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest-email" className={labelClass}>
              {t.dashboard.table.email}
            </Label>
            <Input
              id="guest-email"
              className={fieldClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest-country" className={labelClass}>
              {t.guests.editForm.country}
            </Label>
            <Input
              id="guest-country"
              className={fieldClass}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest-notes" className={labelClass}>
              {t.guests.editForm.notes}
            </Label>
            <Textarea
              id="guest-notes"
              className="max-sm:rounded-xl max-sm:border-[#e2e4da] max-sm:bg-white max-sm:text-sm max-sm:shadow-none max-sm:focus-visible:border-[#07866b] max-sm:focus-visible:ring-[#07866b]/15"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 max-sm:mt-auto max-sm:grid max-sm:grid-cols-[0.8fr_1.2fr] max-sm:pb-[max(env(safe-area-inset-bottom),4px)]">
            <Button
              variant="outline"
              className="max-sm:h-12 max-sm:rounded-xl max-sm:font-bold"
              onClick={() => onOpenChange(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              className="max-sm:h-12 max-sm:rounded-xl max-sm:bg-[#07866b] max-sm:font-bold"
              onClick={save}
              disabled={saving || !fullName.trim()}
            >
              {guest
                ? kk
                  ? "Сақтау"
                  : t.guests.editForm.saveGuest
                : kk
                  ? "Қонақ қосу"
                  : "Добавить гостя"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailPages({
  current,
  total,
  url,
}: {
  current: number;
  total: number;
  url: (page: number) => string;
}) {
  if (total <= GUEST_DETAIL_PAGE_SIZE) return null;
  return (
    <nav
      aria-label="Страницы истории"
      className="mb-3 flex items-center justify-between gap-2 text-xs"
    >
      {current > 1 ? (
        <Link
          className="flex min-h-11 items-center rounded-xl border px-3"
          href={url(current - 1)}
        >
          Назад
        </Link>
      ) : (
        <span />
      )}
      <span>
        Страница {current} · всего {total}
      </span>
      {current * GUEST_DETAIL_PAGE_SIZE < total ? (
        <Link
          className="flex min-h-11 items-center rounded-xl border px-3"
          href={url(current + 1)}
        >
          Далее
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
