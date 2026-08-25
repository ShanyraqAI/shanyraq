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
        No rooms configured yet.
      </div>
    );
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
                <div className="text-base font-semibold">{room.number}</div>
                <div className="text-xs text-muted-foreground">
                  Floor {room.floor} · {room.roomTypeName}
                </div>
              </div>
            </div>
            <RoomStatusBadge status={room.status} />
          </div>

          {room.guestTonight ? (
            <p className="mt-3 truncate rounded-md bg-secondary/60 px-2 py-1 text-xs text-secondary-foreground">
              Tonight: {room.guestTonight}
            </p>
          ) : null}

          <div className="mt-3">
            <Select value={room.status} onValueChange={(v) => changeStatus(room.id, v)} disabled={pendingId === room.id}>
              <SelectTrigger size="sm" className="w-full" aria-label={`Change status of ${room.number}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace("_", " ").toLowerCase()}
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
