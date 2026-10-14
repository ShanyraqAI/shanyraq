import type { z } from "zod";
import type { commandSchema } from "@/lib/communications/schema";
export async function readApi<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || "Не удалось выполнить запрос. Проверьте интернет.");
  return data as T;
}
export async function communicationCommand<T>(scope: string, command: z.infer<typeof commandSchema>): Promise<T> {
  return readApi<T>(await fetch("/api/communications", { method: "POST", headers: { "Content-Type": "application/json", "x-shanyraq-scope": scope }, body: JSON.stringify(command) }));
}
