"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncChannelAction } from "@/server/actions/channels";
import { t } from "@/lib/i18n";
import { channelRequestFailed } from "@/lib/channels/sync-errors";

export function SyncConnectionButton({ connectionId, retry = false, disabled = false }: {
  connectionId: string; retry?: boolean; disabled?: boolean;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef(false);

  async function run() {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);
    try {
      const result = await syncChannelAction(connectionId);
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message);
    } catch {
      toast.error(channelRequestFailed);
    } finally {
      inFlight.current = false;
      setSyncing(false);
      router.refresh();
    }
  }

  return (
    <Button size="sm" onClick={run} disabled={syncing || disabled}>
      {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
      {syncing || disabled ? t.channelsPage.syncButtons.syncing : retry ? "Повторить попытку" : t.channelsPage.syncButtons.syncNow}
    </Button>
  );
}
