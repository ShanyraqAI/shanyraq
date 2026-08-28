"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BedDouble } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoomStatusBadge } from "@/components/shared/status-badge";
import { setRoomStatusAction } from "@/server/actions/rooms";
import type { RoomVM } from "@/lib/types";
import type { RoomStatus } from "@/lib/constants";
import { t } from "@/lib/i18n";

const ROOM_STATUSES: RoomStatus[] = ["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE", "OUT_OF_ORDER"];

export function RoomsGrid({ rooms }: { rooms: RoomVM[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const router = useRouter();

  async function changeStatus(roomId: string, status: string) {
    setPendingId(roomId);
    try {
      const result = await setRoomStatusAction({ roomId, status });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
    } finally {
      setPendingId(null);
    }
  }

  if (rooms.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        {t.rooms.emptyGrid}
      </div>
    );
  }

  const typeCounters = new Map<string, number>();
  const getLabel = (room: RoomVM) => {
    const idx = (typeCounters.get(room.roomTypeId) ?? 0) + 1;
    typeCounters.set(room.roomTypeId, idx);
    const total = rooms.filter((r) => r.roomTypeId === room.roomTypeId).length;
    return total > 1 ? `${room.roomTypeName} · ${idx}` : room.roomTypeName;
  };
  // Сбрасываем счетчики для рендера меток (карта выше уже прошла, но для меток ниже нужен тот же порядок)
  const labelMap = new Map<string, string>();
  {
    const c = new Map<string, number>();
    for (const r of rooms) {
      const idx = (c.get(r.roomTypeId) ?? 0) + 1;
      c.set(r.roomTypeId, idx);
      const total = rooms.filter((x) => x.roomTypeId === r.roomTypeId).length;
      labelMap.set(r.id, total > 1 ? `${r.roomTypeName} · ${idx}` : r.roomTypeName);
    }
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {rooms.map((room) => (
        <div
          key={room.id}
          className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <BedDouble className="size-4" />
              </div>
              <div className="leading-tight">
                <div className="text-base font-semibold truncate" title={labelMap.get(room.id)}>{labelMap.get(room.id)}</div>
                <div className="text-xs text-muted-foreground">
                  {t.rooms.floorLabel(room.floor)}
                </div>
              </div>
            </div>
            <RoomStatusBadge status={room.status} />
          </div>

          {room.guestTonight ? (
            <p className="mt-3 truncate rounded-md bg-secondary/60 px-2 py-1 text-xs text-secondary-foreground">
              {t.rooms.tonight(room.guestTonight)}
            </p>
          ) : null}

          <div className="mt-3">
            <Select value={room.status} onValueChange={(v) => changeStatus(room.id, v)} disabled={pendingId === room.id}>
              <SelectTrigger size="sm" className="w-full" aria-label={t.rooms.changeStatusAria(room.roomTypeName)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t.statuses.room[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}
