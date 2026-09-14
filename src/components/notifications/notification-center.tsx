"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, CalendarClock, CheckCheck, CreditCard, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/server/actions/notifications";

export interface NotificationCenterItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationCenter({ initialItems, initialUnreadCount }: { initialItems: NotificationCenterItem[]; initialUnreadCount: number }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [pending, startTransition] = useTransition();
  const groups = groupNotifications(items);

  function markRead(id: string) {
    if (items.find((item) => item.id === id)?.readAt) return;
    setItems((current) => current.map((item) => item.id === id && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item));
    setUnreadCount((current) => Math.max(0, current - 1));
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  function markAllRead() {
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => item.readAt ? item : { ...item, readAt: now }));
    setUnreadCount(0);
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Уведомления${unreadCount ? `: ${unreadCount} непрочитанных` : ""}`}>
          <Bell className="size-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,390px)] p-0">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Уведомления</h2>
            <p className="text-xs text-muted-foreground">{unreadCount ? `${unreadCount} непрочитанных` : "Всё просмотрено"}</p>
          </div>
          {unreadCount ? <Button variant="ghost" size="sm" onClick={markAllRead} disabled={pending}><CheckCheck className="size-4" /> Прочитать все</Button> : null}
        </header>
        <ScrollArea className="h-[min(65vh,520px)]">
          {items.length ? (
            <div className="pb-2">
              {groups.map((group) => (
                <section key={group.label}>
                  <h3 className="sticky top-0 z-10 bg-popover/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">{group.label}</h3>
                  {group.items.map((item) => <NotificationRow key={item.id} item={item} onRead={() => markRead(item.id)} />)}
                </section>
              ))}
            </div>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center px-8 text-center">
              <Bell className="mb-3 size-8 text-muted-foreground/50" />
              <p className="font-medium">Пока всё спокойно</p>
              <p className="mt-1 text-sm text-muted-foreground">Новые брони, заезды, выезды и важные события появятся здесь.</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NotificationRow({ item, onRead }: { item: NotificationCenterItem; onRead: () => void }) {
  const Icon = item.type === "NEW_RESERVATION" ? CalendarClock : item.type === "PAYMENT_REQUIRED" ? CreditCard : item.type === "STAFF" ? UserPlus : RefreshCw;
  const content = (
    <div className={cn("flex gap-3 border-b px-4 py-3 transition-colors hover:bg-secondary/60", !item.readAt && "bg-primary/[0.045]")}>
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", !item.readAt ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}><Icon className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2"><strong className="flex-1 text-sm font-medium leading-5">{item.title}</strong>{!item.readAt ? <i className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" /> : null}</span>
        {item.body ? <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.body}</span> : null}
        <time className="mt-1 block text-[11px] text-muted-foreground">{formatNotificationTime(item.createdAt)}</time>
      </span>
    </div>
  );
  return item.href ? <Link href={item.href} onClick={onRead}>{content}</Link> : <button type="button" className="w-full text-left" onClick={onRead}>{content}</button>;
}

function groupNotifications(items: NotificationCenterItem[]) {
  const result: { label: string; items: NotificationCenterItem[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    const group = result.find((candidate) => candidate.label === label);
    if (group) group.items.push(item);
    else result.push({ label, items: [item] });
  }
  return result;
}

function dayLabel(value: string): string {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Сегодня";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Вчера";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
}

function formatNotificationTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
