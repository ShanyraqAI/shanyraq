"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncAllChannelsAction } from "@/server/actions/channels";
import { t } from "@/lib/i18n";

export function SyncAllButton({ label = t.channelsPage.syncButtons.syncAll }: { label?: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncAllChannelsAction();
      if (!result.ok) {
        toast.error(result.error ?? t.channelsPage.syncButtons.failed);
        return;
      }
      if (result.data && result.data.results.some((r) => r.status === "FAILED")) {
        toast.warning(result.message);
      } else {
        toast.success(result.message ?? t.channelsPage.syncButtons.complete);
      }
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button onClick={handleSync} disabled={syncing} size="sm">
      {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
      {syncing ? t.channelsPage.syncButtons.syncing : label}
    </Button>
  );
}
