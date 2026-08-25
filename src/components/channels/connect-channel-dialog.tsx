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
        else setInventoryError(result.error ?? "Could not load channel inventory");
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
      setTestResult(result.ok ? { ok: true, message: result.message ?? "Connection successful" } : { ok: false, message: result.error ?? "Connection failed" });
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
    if (!window.confirm(`Disconnect ${channel.name}? Room and rate mappings will be removed.`)) return;
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
            {connected ? `${channel.name} settings` : `Connect ${channel.name}`}
          </DialogTitle>
          <DialogDescription>
            {connected
              ? "Manage the connection and how Shanyraq inventory maps to this channel."
              : "Development mode uses a simulated provider — no real API calls are made."}
          </DialogDescription>
        </DialogHeader>

        {step === "credentials" ? (
          <>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="property-id">Property ID</Label>
                <Input
                  id="property-id"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  placeholder="e.g. 100200330"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="channel manager login" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="api-key">API key / password</Label>
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
                  {testResult.ok ? "Connection successful — " : "Connection failed — "}
                  {testResult.message}
                </div>
              ) : null}
            </div>

            <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={handleTest} disabled={testing || !propertyId || !username || !apiKey}>
                {testing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Test connection
              </Button>
              <Button onClick={handleSave} disabled={saving || !propertyId || !username || !apiKey}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Save connection <ArrowRight className="ml-1 size-4" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-secondary/40 px-3 py-2.5 text-sm">
              <span>
                Property ID: <strong>{propertyId || channel.externalPropertyId}</strong>
                {username ? <> · user <strong>{username}</strong></> : null}
              </span>
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-red-50 hover:text-destructive" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>

            {inventoryError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{inventoryError}</div>
            ) : !inventory ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading channel inventory…
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
