# Архитектурный аудит интеграции Channex

Дата аудита: 24 сентября 2026 г.

## Решение

Channex следует подключать как отдельный транспортный слой рядом с текущей архитектурой `ChannelConnection`, а не как ещё один OTA-канал. Один Channex property обслуживает несколько фактических источников бронирований, поэтому транспортная идентичность (`channexBookingId`) хранится отдельно от `Reservation.sourceChannel` и исходных OTA-полей.

Продуктовый scope — посуточная аренда в Казахстане: квартиры, дома, апарт-отели, гостевые дома и небольшие портфели объектов. Один Channex property должен соответствовать одному физическому объекту с собственным адресом; несвязанные квартиры нельзя объединять в один property ради удобства синхронизации. В клиентском интерфейсе используются нейтральные термины «объект» и «юнит», а `Hotel`/`RoomType` остаются только текущими техническими именами БД.

Этап 1 реализует только постоянную модель данных. Текущие провайдеры, очередь, экран Channels и обработка бронирований не переключаются на Channex.

## 1. Текущие возможности

- Мультитенантная иерархия построена вокруг `Organization -> Hotel`; основные серверные операции получают текущий `hotelId` из сессии.
- `RoomType`, `Room`, `RatePlan`, `Availability` и `Reservation` уже содержат hotel scope. Для большинства критичных связей используются составные ссылки с `hotelId`.
- `ChannelProvider` покрывает проверку credentials, загрузку inventory и бронирований, отправку availability и rates.
- Provider registry отделяет адаптеры от sync service. Реальные внешние адаптеры пока отсутствуют; Booking, Ostrovok и Krisha представлены только локальными mock-провайдерами и запрещены в production.
- Credentials каналов могут храниться в AES-256-GCM envelope; ключ берётся только из server environment. Sync service не логирует ответы провайдера и заменяет ошибки incident ID.
- Изменения бронирований и тарифов ставят `ChannelSyncJob` в той же транзакции, что и бизнес-изменение. Очередь имеет lease, retries, backoff, deduplication и recovery cron.
- Импорт внешней брони идемпотентен по `(hotelId, sourceChannel, externalReservationId)`. Отмена применяется к уже импортированной брони.
- Availability и rates отправляются раздельными provider calls, но текущий sync всегда работает горизонтом 30 дней и выполняет pull + push одним большим сценарием.
- Cron route защищён server-side secret и использует Node.js runtime.

## 2. Критические пробелы

- Нет Channex property, room type и rate plan UUID, environment и состояния provisioning.
- Текущие `ChannelRoomMapping` и `ChannelRateMapping` не содержат `hotelId`; их принадлежность отелю не закреплена составным внешним ключом на уровне БД.
- Нет 500-дневного full sync, property-scoped batching и независимых лимитов для availability и restrictions.
- Текущий outbox дедуплицирует только полный sync соединения; он не хранит тип изменения, room/rate scope и диапазон дат.
- Нет Booking Revisions inbox, acknowledgement state, webhook ingress, backup polling и устойчивой обработки событий вне порядка.
- Текущий импорт поддерживает создание и отмену, но не полноценное изменение существующей брони по revision.
- `importCursor` рассчитан на mock feed и не соответствует acknowledgement-based Booking Revisions Feed.
- Модель ограничений содержит `minStay`/`maxStay` на availability, но не различает minimum-stay-on-arrival/through и не хранит CTA/CTD/stop-sell на тариф и дату.
- Нет Channex task ID/correlation ID, метрик unacknowledged revisions и безопасной истории ошибок интеграции.
- API key Channex нельзя помещать в создаваемые модели: платформенный ключ должен оставаться только в server environment или выделенном encrypted secret store.

## 3. Принятая модель данных

### `ChannexProperty`

Одна запись на `(hotelId, environment)`. Хранит Channex property UUID, webhook UUID, provisioning state, последний обработанный revision ID и только безопасную диагностическую ошибку. Составной FK `(hotelId, organizationId) -> Hotel(id, orgId)` закрепляет tenant на уровне БД.

### `ChannexRoomTypeMapping`

Связывает локальный `RoomType` и Channex room type UUID. Одновременно проверяются составные связи с property, hotel и room type, поэтому mapping другого отеля физически не может быть записан.

### `ChannexRatePlanMapping`

Аналогичная связь локального `RatePlan` с Channex rate plan UUID. Хранит собственное состояние provisioning для безопасного продолжения после частичного сбоя.

### `ChannexBooking`

Хранит транспортные `channexBookingId` и `uniqueId`, ссылку на локальную `Reservation`, а также `otaCode`, `otaName` и `otaReservationCode`. Это не копия бронирования, а таблица идентичности и происхождения.

### `ChannexBookingRevision`

Durable inbox с уникальными `(propertyRefId, revisionId)` и `(propertyRefId, idempotencyKey)`. Хранит тип события, payload для будущей бизнес-обработки, processing/ack timestamps, attempts и ограниченную безопасную ошибку. Повтор webhook/feed не создаёт вторую revision.

Статусы и environments остаются строками, как в существующем проекте, но ограничены PostgreSQL `CHECK` constraints в миграции.

## 4. Граница будущего `ChannexProvider`

`ChannexProvider` не должен реализовывать общий текущий `ChannelProvider`: Channex обслуживает несколько OTA и использует другие гарантии доставки. Предлагаемая граница:

- `listProperties()` — read-only connectivity check;
- `createProperty`, `createRoomType`, `createRatePlan` — provisioning;
- `pushAvailability` — отдельный availability request;
- `pushRestrictions` — rates/restrictions request;
- `requestFullSync` или orchestrator над теми же двумя push-операциями;
- `listBookingRevisionFeed`, `getBookingRevision`, `acknowledgeBookingRevision`;
- `createWebhook`/`deleteWebhook` и one-time iframe token на соответствующих этапах.

Клиент должен принимать environment/server-side key, иметь timeout, typed result/error и retry только для безопасных запросов. Он не должен знать о сессии пользователя, Prisma или UI; tenant checks и транзакции принадлежат сервисному слою Shanyraq.

## 5. Миграции

На этапе 1 нужна одна полностью аддитивная миграция:

1. Добавить составной unique index `Reservation(id, hotelId)` для tenant-safe optional link.
2. Создать пять Channex-таблиц.
3. Добавить unique/index/check constraints.
4. Добавить составные tenant foreign keys.
5. Не менять и не backfill-ить существующие `ChannelConnection`, mappings, jobs и reservations.

Последующие этапы должны создавать отдельные миграции только при появлении реального бизнес-требования: тарифные ограничения (этап 4), delta outbox (этап 5) и operational correlation/task metadata (этап 10).

## 6. Последовательность реализации

1. Постоянная модель и миграция.
2. Server-only API client и staging connectivity check.
3. Идемпотентный provisioning property/room types/rate plans.
4. Полная модель тарифных ограничений в PMS.
5. Delta outbox с отдельными availability и restrictions events.
6. 500-дневный full sync поверх тех же readers/senders.
7. Booking revision processor с транзакционным inbox и ack-after-commit.
8. Webhook + общий backup polling feed.
9. Embedded mapping flow.
10. Monitoring, recovery и certification audit.

## 7. Риски миграции текущей channel architecture

- Если зарегистрировать Channex как обычный `Channel`, `Reservation.sourceChannel` станет `channex` и будет потерян Booking.com/Airbnb/ETG attribution.
- Одновременная работа legacy sync и Channex для одного отеля может дважды отправлять inventory. Активация должна быть взаимоисключающей и по отелю.
- Текущий full-connection job нельзя незаметно переиспользовать для Channex: он смешивает pull bookings и push inventory и имеет 30-дневный горизонт.
- Существующие mappings нельзя автоматически переносить: их внешние IDs принадлежат конкретным OTA, а не Channex room/rate entities.
- Raw booking revision может содержать PII и guarantee data. Inbox нужен для надёжности, но доступ должен быть server-only, логи — редактированными, а retention/PCI policy — определены до этапа входящих броней.
- Staging и production UUID нельзя переносить между environments; уникальность и отдельные записи environment заложены в модели.

## 8. Фактический источник и транспорт

- `ChannexBooking.channexBookingId` — идентификатор транспорта Channex.
- `ChannexBooking.otaCode`, `otaName`, `otaReservationCode` — исходный канал продаж.
- После обработки revision `Reservation.sourceChannel` получает нормализованный фактический OTA-код (`booking`, `airbnb`, `etg` и т. п.), а `Reservation.externalReservationId` — исходный OTA reservation code/стабильный OTA identifier.
- Связь с `ChannexBooking` сохраняет Channex transport ID для modifications, cancellations и acknowledgement, не искажая отчёты по источникам продаж.

## Официальные основания

- Channex рекомендует PMS создавать property, room types и rate plans через отдельные API и сохранять mappings: <https://docs.channex.io/guides/pms-integration-guide>.
- Booking Revision содержит отдельные `id`, `booking_id`, `unique_id`, `ota_reservation_code` и `ota_name`; feed возвращает не acknowledged revisions: <https://docs.channex.io/api-v.1-documentation/bookings-collection>.
- Availability и rates/restrictions должны отправляться отдельными запросами и батчироваться по property: <https://docs.channex.io/guides/pms-integration-guide>.
