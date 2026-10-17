"use client";
import { useRouter } from "next/navigation";
import { RoomCommunicationEditor } from "@/components/communications/room-editor";
import { RoomsGrid } from "./rooms-grid";
import type { RoomCommunicationVM } from "@/lib/communications/types";
import type { RoomVM } from "@/lib/types";

export function ApartmentEditor({ room, communication, scope, locale }: { room: RoomVM; communication: RoomCommunicationVM; scope: string; locale: "ru" | "kk" }) {
  const router = useRouter();
  const kk = locale === "kk";
  return <div className="space-y-6"><section className="flex items-center justify-between gap-3 border-b pb-4"><div className="min-w-0"><h2 className="text-base font-semibold">{kk ? "Нөмір, қабат және күй" : "Номер, этаж и статус"}</h2><p className="mt-1 text-sm text-muted-foreground">{kk ? "Баға мен сыйымдылық пәтер түрінен алынады." : "Цена и вместимость наследуются от типа квартиры."}</p></div><RoomsGrid rooms={[]} roomTypes={[room.roomTypeName]} typeDetails={[{ name: room.roomTypeName, capacity: room.capacity ?? 1, basePrice: room.basePrice ?? 0 }]} editRoom={room} addButtonOnly locale={locale} /></section><RoomCommunicationEditor room={communication} scope={scope} editable onSaved={async () => { router.refresh(); }} /></div>;
}
