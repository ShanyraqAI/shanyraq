# Подключение Shanyraq к Channex Staging

Shanyraq подключается к тестовой среде Channex. Production API key не нужен до завершения тестов и сертификации.

## 1. Создание API key в Channex

1. Откройте <https://staging.channex.io/>.
2. Перейдите в Organisation → API Keys.
3. Нажмите **Create new API Key**.
4. Для первого теста включите доступ ко всем staging-объектам.
5. Скопируйте ключ сразу: Channex показывает его только один раз.

Ключ нельзя отправлять в чат, добавлять в Git или помещать в переменную с префиксом `NEXT_PUBLIC_`.

## 2. Куда вставить ключ

### Vercel

Откройте проект `shanyraq` → Settings → Environment Variables и создайте переменную:

```text
Name: CHANNEX_STAGING_API_KEY
Value: ключ из Channex
Environment: Production
```

Для тестового подключения должны быть настроены и остальные значения:

```text
NEXT_PUBLIC_CHANNELS_ENABLED=true
APP_URL=https://shanyraqai.vercel.app
CHANNEX_WEBHOOK_URL=https://shanyraqai.vercel.app/api/channex/webhooks/booking
CHANNEX_WEBHOOK_SECRET=<случайный секрет не короче 32 байт>
CRON_SECRET=<другой случайный секрет не короче 32 байт>
```

`CHANNEX_WEBHOOK_SECRET` и `CRON_SECRET` должны отличаться. После изменения переменных выполните новый production deployment: переменная `NEXT_PUBLIC_CHANNELS_ENABLED` применяется во время сборки.

### Локальный запуск

Добавьте те же переменные в файл `.env.local` в корне проекта. Этот файл исключён из Git. Для локального webhook нужен публичный HTTPS-туннель; адрес `localhost` Channex вызвать не сможет.

## 3. Подготовка объекта в Shanyraq

До подключения у объекта должны быть:

- тип размещения;
- хотя бы один физический юнит;
- хотя бы один тариф;
- корректные валюта и часовой пояс;
- цены и ограничения на будущие даты.

## 4. Первый запуск

1. Откройте **Каналы** в Shanyraq.
2. Убедитесь, что карточка объекта не показывает незаполненных условий.
3. Нажмите **Подключить к Channex staging**.
4. Shanyraq создаст или найдёт совпадающий property, создаст room types и rate plans, зарегистрирует booking webhook и поставит 500-дневную полную синхронизацию в очередь.
5. В Channex проверьте Inventory: остатки, цены, minimum stay, stop sell, CTA и CTD.

## 5. Проверка бронирований

Для первого безопасного теста можно использовать приложение Booking CRS в Channex:

1. Создайте новую бронь и проверьте её появление в календаре Shanyraq.
2. Измените даты или гостя и проверьте обновление существующей брони.
3. Отмените бронь и проверьте статус в Shanyraq.
4. Измените цену в Shanyraq и убедитесь, что новая цена появилась в Channex.
5. Создайте прямую бронь в Shanyraq и убедитесь, что доступность уменьшилась в Channex.

Входящие события сохраняются идемпотентно, обрабатываются через Booking Revision Feed и подтверждаются только после записи брони в PostgreSQL.

## 6. Переход в production

Production включается отдельным этапом после прохождения staging-сценариев Channex. Staging UUID и production UUID нельзя переносить между окружениями. До отдельного production-релиза `CHANNEX_PRODUCTION_API_KEY` следует оставить пустым.
