import type { z } from "zod";
import type { commandSchema } from "@/lib/communications/schema";
export class CommunicationApiError extends Error {
  constructor(message: string, public status: number, public code = "REQUEST_FAILED", public retryable = true, public requestId?: string) { super(message); this.name = "CommunicationApiError"; }
}
export async function readApi<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new CommunicationApiError(typeof data?.error === "string" ? data.error : "Не удалось загрузить данные. Проверьте соединение и повторите попытку.", response.status, typeof data?.code === "string" ? data.code : undefined, typeof data?.retryable === "boolean" ? data.retryable : response.status >= 500, typeof data?.requestId === "string" ? data.requestId.slice(0, 80) : undefined);
  return data as T;
}
export async function communicationCommand<T>(scope: string, command: z.infer<typeof commandSchema>): Promise<T> {
  return readApi<T>(await fetch("/api/communications", { method: "POST", headers: { "Content-Type": "application/json", "x-shanyraq-scope": scope }, body: JSON.stringify(command) }));
}
