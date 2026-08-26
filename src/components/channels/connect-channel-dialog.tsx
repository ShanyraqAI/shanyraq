"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  PlugZap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MappingEditor } from "./mapping-editor";
import {
  connectChannelAction,
  disconnectChannelAction,
  fetchExternalInventoryAction,
  testChannelConnectionAction,
} from "@/server/actions/channels";
import type { ExternalInventory } from "@/lib/channels/types";
import type { RatePlanVM } from "@/lib/types";
import { t } from "@/lib/i18n";

interface Props {
  channel: {
    id: string;
    name: string;
    status: "CONNECTED" | "DISCONNECTED" | "ERROR";
    connectionId: string | null;
    externalPropertyId: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  internalRoomTypes: { id: string; name: string }[];
  internalRatePlans: (RatePlanVM & { roomTypeName: string })[];
  initialRoomMappings?: { roomTypeId: string; externalRoomTypeId: string; externalRoomName: string }[];
  initialRateMappings?: { ratePlanId: string; externalRateId: string; externalRateName: string }[];
}

export function ConnectChannelDialog({
  channel,
  open,
  onOpenChange,
  internalRoomTypes,
  internalRatePlans,
  initialRoomMappings = [],
  initialRateMappings = [],
}: Props) {
  const router = useRouter();
  const connected = channel.status !== "DISCONNECTED" && Boolean(channel.connectionId);

  const [step, setStep] = useState<"credentials" | "mapping">(connected ? "mapping" : "credentials");
  const [propertyId, setPropertyId] = useState(channel.externalPropertyId ?? "");
  const [username, setUsername] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [inventory, setInventory] = useState<ExternalInventory | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // Load external catalogue when entering the mapping step.
  useEffect(() => {
    if (open && step === "mapping" && !inventory && !inventoryError) {
      fetchExternalInventoryAction(channel.id).then((result) => {
        if (result.ok && result.data) setInventory(result.data);
        else setInventoryError(result.error ?? t.channelsPage.dialog.inventoryErrorFallback);
      });
    }
  }, [open, step, inventory, inventoryError, channel.id]);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testChannelConnectionAction({
        channelId: channel.id,
        externalPropertyId: propertyId,
        username,
        apiKey,
      });
      setTestResult(result.ok ? { ok: true, message: result.message ?? t.channelsPage.dialog.testOk } : { ok: false, message: result.error ?? t.channelsPage.dialog.testFailed });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await connectChannelAction({
        channelId: channel.id,
        externalPropertyId: propertyId,
        username,
        apiKey,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (channel.connectionId === null) router.refresh();
      toast.success(result.message);
      setStep("mapping");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!channel.connectionId) return;
    if (!window.confirm(t.channelsPage.dialog.disconnectConfirm(channel.name))) return;
    const result = await disconnectChannelAction(channel.connectionId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setStep(connected ? "mapping" : "credentials");
          setTestResult(null);
          setApiKey("");
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlugZap className="size-4 text-primary" />
            {connected ? t.channelsPage.dialog.settingsTitle(channel.name) : t.channelsPage.dialog.connectTitle(channel.name)}
          </DialogTitle>
          <DialogDescription>
            {connected
              ? t.channelsPage.dialog.settingsDescription
              : t.channelsPage.dialog.connectDescription}
          </DialogDescription>
        </DialogHeader>

        {step === "credentials" ? (
          <>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="property-id">{t.channelsPage.dialog.propertyId}</Label>
                <Input
                  id="property-id"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  placeholder={t.channelsPage.dialog.propertyIdPlaceholder}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="username">{t.channelsPage.dialog.username}</Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t.channelsPage.dialog.usernamePlaceholder} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="api-key">{t.channelsPage.dialog.apiKey}</Label>
                  <Input id="api-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••••••" />
                </div>
              </div>

              {testResult ? (
                <div
                  className={
                    testResult.ok
                      ? "flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                      : "flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  }
                >
                  {testResult.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
                  {testResult.ok ? t.channelsPage.dialog.testOk : t.channelsPage.dialog.testFailed}
                  {testResult.message}
                </div>
              ) : null}
            </div>

            <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={handleTest} disabled={testing || !propertyId || !username || !apiKey}>
                {testing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {t.channelsPage.dialog.testConnection}
              </Button>
              <Button onClick={handleSave} disabled={saving || !propertyId || !username || !apiKey}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {t.channelsPage.dialog.saveConnection} <ArrowRight className="ml-1 size-4" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-secondary/40 px-3 py-2.5 text-sm">
              <span>
                {t.channelsPage.dialog.summaryPropertyId} <strong>{propertyId || channel.externalPropertyId}</strong>
                {username ? <>{t.channelsPage.dialog.summaryUser}<strong>{username}</strong></> : null}
              </span>
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-red-50 hover:text-destructive" onClick={handleDisconnect}>
                {t.common.disconnect}
              </Button>
            </div>

            {inventoryError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{inventoryError}</div>
            ) : !inventory ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {t.channelsPage.dialog.loadingInventory}
              </div>
            ) : (
              <MappingEditor
                connectionId={channel.connectionId ?? ""}
                channelCode={channel.name}
                internalRoomTypes={internalRoomTypes}
                internalRatePlans={internalRatePlans}
                inventory={inventory}
                initialRoomMappings={initialRoomMappings}
                initialRateMappings={initialRateMappings}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
