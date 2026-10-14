import type { ProfileInput } from "./schema";
import type { TemplateValues } from "./template";
export interface PhotoVM { id: string; name: string; position: number }
export interface TemplateVM { id: string; name: string; body: string; language: string; status: string; roomId: string | null; version: number; isDefault: boolean }
export interface RoomCommunicationVM { id: string; label: string; profile: ProfileInput; version: number; photos: PhotoVM[] }
export interface HistoryVM { id: string; guestName: string; reservationId: string; createdAt: string; state: string }
export interface CommunicationWorkspace { rooms: RoomCommunicationVM[]; templates: TemplateVM[]; history: HistoryVM[]; nextCursor: string | null; owner: boolean; scope: string }
export interface ReservationCommunicationWorkspace {
  reservationId: string; guestName: string; phone: string | null; roomName: string; values: TemplateValues;
  templates: TemplateVM[]; photos: PhotoVM[]; scope: string;
}
export interface PreparedMessage { id: string; text: string; phone: string; photoIds: string[]; scope: string }
export const HISTORY_LABELS: Record<string, string> = {
  DRAFT: "Подготовлено — не отправлено",
  MANUAL_WHATSAPP_OPENED: "Открыт WhatsApp — ожидается ручная отправка",
  SHARE_RETURNED: "Передано в меню «Поделиться» — отправка не подтверждена",
};
