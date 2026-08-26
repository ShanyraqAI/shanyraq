"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Link2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveRateMappingsAction, saveRoomMappingsAction } from "@/server/actions/channels";
import type { ExternalInventory } from "@/lib/channels/types";
import type { RatePlanVM } from "@/lib/types";
import { t } from "@/lib/i18n";

export interface RoomTypeOption {
  id: string;
  name: string;
}

interface Props {
  connectionId: string;
  channelCode: string;
  internalRoomTypes: RoomTypeOption[];
  internalRatePlans: (RatePlanVM & { roomTypeName: string })[];
  inventory: ExternalInventory;
  initialRoomMappings: { roomTypeId: string; externalRoomTypeId: string; externalRoomName: string }[];
  initialRateMappings: { ratePlanId: string; externalRateId: string; externalRateName: string }[];
}

/** Simple name-based suggestion so the mapping UI starts mostly pre-filled. */
function suggest(internalName: string, externals: { id: string; name: string }[]): string | null {
  const target = internalName.toLowerCase();
  const exact = externals.find((e) => e.name.toLowerCase() === target);
  if (exact) return exact.id;
  const partial = externals.find(
    (e) => e.name.toLowerCase().includes(target) || target.includes(e.name.toLowerCase().split(" ")[0]),
  );
  return partial?.id ?? null;
}

const UNMAPPED = "__unmapped__";

export function MappingEditor({
  connectionId,
  channelCode,
  internalRoomTypes,
  internalRatePlans,
  inventory,
  initialRoomMappings,
  initialRateMappings,
}: Props) {
  const router = useRouter();
  const [roomSelections, setRoomSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const rt of internalRoomTypes) {
      init[rt.id] = initialRoomMappings.find((m) => m.roomTypeId === rt.id)?.externalRoomTypeId ?? suggest(rt.name, inventory.roomTypes) ?? UNMAPPED;
    }
    return init;
  });
  const [rateSelections, setRateSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const rp of internalRatePlans) {
      init[rp.id] = initialRateMappings.find((m) => m.ratePlanId === rp.id)?.externalRateId ?? suggest(rp.name, inventory.ratePlans) ?? UNMAPPED;
    }
    return init;
  });
  const [saving, setSaving] = useState<"rooms" | "rates" | null>(null);

  const roomMappedCount = useMemo(
    () => Object.values(roomSelections).filter((v) => v !== UNMAPPED).length,
    [roomSelections],
  );
  const rateMappedCount = useMemo(
    () => Object.values(rateSelections).filter((v) => v !== UNMAPPED).length,
    [rateSelections],
  );

  async function saveRooms() {
    setSaving("rooms");
    try {
      const mappings = Object.entries(roomSelections)
        .filter(([, extId]) => extId !== UNMAPPED)
        .map(([roomTypeId, extId]) => {
          const ext = inventory.roomTypes.find((e) => e.id === extId)!;
          return { roomTypeId, externalRoomTypeId: ext.id, externalRoomName: ext.name };
        });
      const result = await saveRoomMappingsAction({ connectionId, mappings });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
    } finally {
      setSaving(null);
    }
  }

  async function saveRates() {
    setSaving("rates");
    try {
      const mappings = Object.entries(rateSelections)
        .filter(([, extId]) => extId !== UNMAPPED)
        .map(([ratePlanId, extId]) => {
          const ext = inventory.ratePlans.find((e) => e.id === extId)!;
          return { ratePlanId, externalRateId: ext.id, externalRateName: ext.name };
        });
      const result = await saveRateMappingsAction({ connectionId, mappings });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* Room mapping */}
      <section className="rounded-xl border bg-card shadow-sm">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Link2 className="size-4 text-primary" /> {t.channelsPage.mapping.roomMapping}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t.channelsPage.mapping.roomSubtitle(channelCode, roomMappedCount, internalRoomTypes.length)}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={saveRooms} disabled={saving !== null}>
            {saving === "rooms" ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Save className="mr-1.5 size-3.5" />}
            {t.common.save}
          </Button>
        </header>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[45%]">{t.channelsPage.mapping.shanyraqColumn}</TableHead>
              <TableHead className="w-8" />
              <TableHead>{channelCode}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {internalRoomTypes.map((rt) => (
              <TableRow key={rt.id}>
                <TableCell className="font-medium">{rt.name}</TableCell>
                <TableCell>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </TableCell>
                <TableCell>
                  <Select
                    value={roomSelections[rt.id]}
                    onValueChange={(v) => setRoomSelections((s) => ({ ...s, [rt.id]: v }))}
                  >
                    <SelectTrigger size="sm" className="w-full" aria-label={t.channelsPage.mapping.mapAria(rt.name)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNMAPPED}>{t.channelsPage.mapping.unmapped}</SelectItem>
                      {inventory.roomTypes.map((ext) => (
                        <SelectItem key={ext.id} value={ext.id}>
                          {ext.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* Rate mapping */}
      <section className="rounded-xl border bg-card shadow-sm">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Link2 className="size-4 text-primary" /> {t.channelsPage.mapping.rateMapping}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t.channelsPage.mapping.rateSubtitle(channelCode, rateMappedCount, internalRatePlans.length)}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={saveRates} disabled={saving !== null}>
            {saving === "rates" ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Save className="mr-1.5 size-3.5" />}
            {t.common.save}
          </Button>
        </header>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[45%]">{t.channelsPage.mapping.shanyraqColumn}</TableHead>
              <TableHead className="w-8" />
              <TableHead>{channelCode}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {internalRatePlans.map((rp) => (
              <TableRow key={rp.id}>
                <TableCell className="leading-tight">
                  <div className="font-medium">{rp.name}</div>
                  <div className="text-xs text-muted-foreground">{rp.roomTypeName}</div>
                </TableCell>
                <TableCell>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </TableCell>
                <TableCell>
                  <Select
                    value={rateSelections[rp.id]}
                    onValueChange={(v) => setRateSelections((s) => ({ ...s, [rp.id]: v }))}
                  >
                    <SelectTrigger size="sm" className="w-full" aria-label={t.channelsPage.mapping.mapAria(rp.name)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNMAPPED}>{t.channelsPage.mapping.unmapped}</SelectItem>
                      {inventory.ratePlans.map((ext) => (
                        <SelectItem key={ext.id} value={ext.id}>
                          {ext.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
