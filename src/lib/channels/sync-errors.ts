const incidentPattern = /^Синхронизация не выполнена\. Код (?:ошибки|инцидента): ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const syncBusyMessage = "Синхронизация уже выполняется. Дождитесь её завершения и обновите страницу.";
export const channelRequestFailed = "Не удалось выполнить действие. Обновите страницу и проверьте результат перед повторной попыткой.";

/** Never expose stored provider errors, including legacy records. */
export function getSyncIncidentId(storedError: string | null | undefined): string | null {
  return storedError?.match(incidentPattern)?.[1] ?? null;
}

export function syncFailureMessage(incidentId: string | null): string {
  return incidentId
    ? `Синхронизация не выполнена. Код инцидента: ${incidentId}`
    : "Синхронизация не выполнена. Повторите попытку или обратитесь в поддержку.";
}
