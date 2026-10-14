import type { ActionResult } from "@/server/types";
import type { MutationContext } from "./mutation-context";
import {
  enqueueOutbox,
  getOutboxScope,
  isDeviceOffline,
  isNetworkError,
} from "./outbox";
export const QUEUED_MESSAGE =
  "Сохранено на устройстве. Отправим, когда появится интернет.";
export async function dispatchOfflineAction(
  kind: string,
  label: string,
  args: unknown[],
  call: (context: MutationContext) => Promise<ActionResult<unknown>>,
): Promise<ActionResult<unknown> & { queued?: boolean }> {
  const scope = getOutboxScope();
  if (!scope)
    return {
      ok: false,
      error: "Рабочий контекст изменился. Обновите страницу нужного объекта.",
    };
  const context = { key: crypto.randomUUID(), scope };
  const queue = () =>
    enqueueOutbox({ kind, label, args, id: context.key, scope })
      ? { ok: true as const, queued: true, message: QUEUED_MESSAGE }
      : {
          ok: false as const,
          error:
            "Рабочий контекст изменился. Проверьте результат на сервере перед повтором.",
        };
  if (isDeviceOffline()) return queue();
  try {
    return await call(context);
  } catch (error) {
    if (isNetworkError(error)) return queue();
    throw error;
  }
}
