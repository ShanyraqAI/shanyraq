"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disconnectChannelAction } from "@/server/actions/channels";
import { channelRequestFailed } from "@/lib/channels/sync-errors";

export function DeleteConnectionButton({ connectionId, channelName, disabled = false, onDeleted }: {
  connectionId: string;
  channelName: string;
  disabled?: boolean;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (disabled || inFlight.current) return;
    if (!window.confirm(`Удалить подключение ${channelName}? Учётные данные, сопоставления номеров и тарифов и журнал синхронизаций будут удалены. Бронирования сохранятся. Подключиться заново можно в любое время.`)) return;
    inFlight.current = true;
    setDeleting(true);
    try {
      const result = await disconnectChannelAction(connectionId);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        onDeleted?.();
      }
    } catch {
      toast.error(channelRequestFailed);
    } finally {
      inFlight.current = false;
      setDeleting(false);
      router.refresh();
    }
  }

  return (
    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
      disabled={disabled || deleting} onClick={remove} aria-label={`Удалить подключение ${channelName}`}>
      {deleting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Trash2 className="mr-1.5 size-3.5" />}
      {deleting ? "Удаление…" : "Удалить"}
    </Button>
  );
}
