"use client";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommunicationApiError } from "./api";
import { SECONDARY_TEXT } from "./fields";
export function LoadFailure({ error, onRetry, busy = false, owner = false }: { error: unknown; onRetry: () => void; busy?: boolean; owner?: boolean }) {
  const api = error instanceof CommunicationApiError ? error : null;
  const setup = api?.code === "SETUP_REQUIRED";
  const configuration = api?.code === "SERVER_CONFIGURATION";
  const signIn = api?.status === 401;
  const denied = api?.status === 403;
  return <section role="alert" className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
    <h2 className="flex items-start gap-2 font-semibold"><AlertCircle className="mt-0.5 size-5 shrink-0 text-primary" />{setup ? "Нужно завершить настройку сервера" : configuration ? "Проверьте настройки сервера" : signIn ? "Войдите снова" : denied ? "Нет доступа к коммуникациям" : "Не удалось загрузить данные"}</h2>
    <p className={SECONDARY_TEXT}>{setup ? "Интерфейс обновлён, но база данных ещё не готова. Повторное нажатие не исправит настройку. Обратитесь к владельцу проекта." : signIn ? "Сессия завершилась. Войдите в аккаунт и вернитесь к отправке." : denied ? "Для этого раздела нужен доступ к бронированиям. Обратитесь к владельцу объекта." : api?.message || "Проверьте интернет-соединение. Если ошибка повторяется, сообщите владельцу проекта."}</p>
    {(setup || configuration) && owner ? <details className="rounded-xl border p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Что проверить владельцу проекта</summary><p className={`mt-2 ${SECONDARY_TEXT}`}>{setup ? "Проверьте, что деплой и Prisma Client одной версии, а миграции применены к базе этого окружения. Preview-сборка сама миграции не запускает. Используйте отдельную тестовую базу; не меняйте production ради preview." : "Проверьте переменные окружения и подключение к базе именно этого деплоя. Не отправляйте пароль или адрес подключения в чат."}</p></details> : null}
    {api?.requestId ? <p className={`break-all ${SECONDARY_TEXT}`}>Код обращения: {api.requestId}</p> : null}
    {signIn ? <Button asChild className="min-h-11 w-full sm:w-auto"><a href="/login">Войти в аккаунт</a></Button> : denied ? null : <Button className="min-h-11 w-full sm:w-auto" variant="outline" disabled={busy} onClick={onRetry}><RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />{busy ? "Проверяем…" : setup || configuration ? "Проверить после настройки" : "Повторить загрузку"}</Button>}
  </section>;
}
