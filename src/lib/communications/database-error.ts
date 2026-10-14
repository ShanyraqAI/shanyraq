export function databaseFailure(error: unknown) {
  if (!error || typeof error !== "object" || !("name" in error) || typeof error.name !== "string" || !error.name.startsWith("PrismaClient")) return null;
  const code = "code" in error && typeof error.code === "string" ? error.code : "errorCode" in error && typeof error.errorCode === "string" ? error.errorCode : undefined;
  if (code === "P2021" || code === "P2022") return { code: "SETUP_REQUIRED", status: 503, retryable: false, message: "Раздел коммуникаций ещё не настроен на сервере. Владельцу проекта нужно применить обновление базы данных." };
  if (["P1000", "P1010", "P1012"].includes(code ?? "")) return { code: "SERVER_CONFIGURATION", status: 503, retryable: false, message: "Нужно проверить настройки подключения сервера. Обратитесь к владельцу проекта." };
  if (["P1001", "P1002", "P1017", "P2024"].includes(code ?? "")) return { code: "SERVICE_UNAVAILABLE", status: 503, retryable: true, message: "Сервер временно не отвечает. Ваш текст остаётся в открытом редакторе; повторите попытку немного позже." };
  return null;
}
