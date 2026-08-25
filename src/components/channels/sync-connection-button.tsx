"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncChannelAction } from "@/server/actions/channels";

export function SyncConnectionButton({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function run() {
    setSyncing(true);
    try {
      const result = await syncChannelAction(connectionId);
      if (!result.ok) toast.error(result.error);
      else if (result.data?.status === "PARTIAL") toast.warning(result.message);
      else toast.success(result.message);
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button size="sm" onClick={run} disabled={syncing}>
      {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
      {syncing ? "Synchronizing…" : "Sync now"}
    </Button>
  );
}
