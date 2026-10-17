# Mobile-first: аудит и последовательная реализация

## База и ограничения проверки

- По явному выбору владельца: `main`, `b09db49df61aea83ce5c4d651af3b57ed8017274`.
- Ветка реализации: `feat/mobile-first-apartment-audit-20261017`, создана ровно от этого SHA.
- Исходники получены через авторизованный GitHub MCP. Локальная папка — частичная выгрузка, не полный checkout. Обычный git clone не авторизован. Нельзя выдавать проверки этой папки за полный CI проекта.
- AGENTS.md прочитан. Документация Next.js **16.3.3** получена из npm-пакета этой версии: `dist/docs`; прочитаны Server and Client Components и page.js (Promise params/searchParams).
- PR #19 и #21 (communications + reliability), #22 (календарь квартиры) merged; их существующая реализация сохраняется.
- PR #23 (guided booking/message UX) открыт и не включён в main; его diff изучен. Не переносить весь PR автоматически, не откатывать main к старой базе PR. PR #24 — отдельный opt-in offline overview, также не база этой работы.
- Vercel MCP требует повторной авторизации. Preview и production не подтверждены.

## Карта функций и источников

| Функция | Сейчас | Целевая точка | Подтверждённый backend | Разрыв / классификация |
|---|---|---|---|---|
| Профиль квартиры | `/dashboard/rooms/[roomId]`: краткий dl и весь TTLockWorkspace | Профиль: жильё, фото, цена типа, редактирование, компактные ссылки | Room + RoomType, tenant-scoped findFirst | Визуальная/навигационная: TTLock доминирует |
| Цена и вместимость | RoomType; `upsertRoomAction` обновляет существующий тип из формы одной квартиры | Наследование явно показано; никаких записей общей цены из unit-form | RoomType.basePrice/capacity, RatePlan, availability + channel outbox | Ошибка записи общих данных, не косметика. Исправлять отдельным коммитом |
| Имя, адрес, инструкции | Communications → квартиры → постоянно открытая форма | Просмотр в профиле, явное редактирование | CommunicationProfile, version check, tenant filter, audit | Навигация. Секреты нельзя передавать в public presentation |
| Фотографии | communications/photos; приватный endpoint | Галерея квартиры, явное добавление в сообщение | CommunicationPhoto bytes; JPEG/PNG/WebP, 4 МБ input, шесть фото | Не нужна новая публичная storage. Нужны прежние права RESERVATIONS |
| Описание/удобства | RoomType.description — общее описание; per-unit amenities отсутствуют в просмотренной схеме | Явно подписанное описание типа; per-unit позже | RoomType.description | Новые unit-поля — отдельная миграция, без выдуманных удобств |
| Карточка гостя | guests-table: три tab, edit сверху + footer, закрывается после сохранения | Один edit на каждом breakpoint, без постоянного mobile footer, сохранять карточку/tab/scroll | Существующие guest offline actions и пагинация | Визуальная/сохранение контекста |
| Сообщение | composer: три обязательных шага, readonly ready text до карандаша | Сообщение → Проверка, inline attachments | `/api/communications`, immutable prepared snapshot, requestKey idempotency, photo preloading | UX. Серверного сохранения редактируемого черновика пока нет |
| Документы | generatedDocument + DocumentProfile + DocumentSigningRequest | Реквизиты — одно место; действия из бронирования | PDF snapshots, tenant isolation, digest/token, expiration, revoke, locked transactions, audit | Комплект/две стороны/провайдер отсутствуют в проверенной модели |
| Подтверждение по ссылке | Один PDF, typed name + explicit consent | Честное описание фактического способа; новая юридическая модель отдельно | `method: LINK_TYPED_NAME`, `identityVerified: false` | Не OTP, не ЭЦП, не доказанное двустороннее заключение |
| TTLock | полный workspace в профиле, отдельный `/dashboard/locks` | Профиль → компактный status → отдельный access route; выпуск из брони | TTLockConnection/Lock/Passcode/Event, явные server actions, hotel filters | Навигация/мобильная раскладка; не новая интеграция |
| Настройки | mobile groups; desktop tabs игнорируют `section` | Бизнес / Работа с гостями / Подключения; одинаковые прямые ссылки | Единственный DocumentProfile, hotel settings, memberships, notification preferences | Навигация; старые query URLs сохранить |
| Платежи гостя | В брони total + deposit tracking; paid на mobile пока `—` | Контекстный запрос, реальные финансовые суммы | Reservation fields и существующие финансовые actions; не менять их ради UI | Сверка денежной модели обязательна перед Kaspi |
| Kaspi Pay | В проверенных настройках, schema и env не найден подтверждённый guest-payment adapter | Настройки приёма оплаты + booking request | FreedomPay env относится к billing подписки платформы | Не считать search miss доказательством отсутствия; полный аудит адаптеров ещё нужен |
| SMS / OTP | В проверенных schema/API directories/env нет подтверждённого SMS-провайдера; есть notification/email/push модули | Три разных сценария: OTP, info SMS, door code | Есть email и VAPID настройки; не доказана SMS-отправка | Внешняя интеграция/доступ провайдера, не рисовать работающую кнопку |
| Offline | scoped outbox, operation receipts; private HTML page cache отключён | Сохранить scope/user/hotel isolation и replay through server actions | outbox.ts, device-data.ts, migration operation_receipts | Не добавлять документы/коды/ссылки в public cache |

## Права и безопасность

- Room/profile/access entry сохраняет `requireSectionAccess("ROOMS")`; каждая room query ограничена текущим hotel.
- Communications API и приватные фото нельзя обходить новым SSR-представлением; дополнительные сведения показывать только с существующим permission.
- Право изменения communications-профиля — OWNER, а не любой читатель квартиры.
- Открытие экрана не выпускает код, не подписывает документ, не отправляет SMS и не создаёт платёж.
- Никаких новых публичных ссылок квартиры, автоматического раскрытия адреса, ключей, Wi-Fi, guest PII или приватных фото.
- Release/schema gates, Prisma relations, financial operations и outbox не отключаются.

## Юридический механизм: решение ещё не принято

Текущий LINK_TYPED_NAME сохраняется как существующий механизм с ограничениями. Он не выбран как подтверждённая legal production model для нового комплекта. Варианты A/B/C должен выбрать уполномоченный заказчик с юридической проверкой. Нет оснований утверждать, что TrustMe/TrustContract API доступен.

Предлагаемые переходы для будущего отдельного этапа:

`NOT_PREPARED → PREPARED → AWAITING_ACTIONS → COMPLETED`.

Только необходимые действия обеих сторон переводят комплект в COMPLETED; expiry/revoke/error не завершают договор. Изменение существенных условий создаёт новую версию и `REQUIRES_REAGREEMENT`, старое evidence неизменно. Link created / handed to app / provider sent / delivered / opened — независимая шкала передачи, не юридический статус.

Минимальный обезличенный evidence manifest (спецификация, не реально подписанный пакет): booking internal ID, immutable PDFs + SHA256, template/rules versions, party roles, selected confirmation method, timestamps, provider operation/verification receipt when available, audit events. Сейчас реализован только subset с PDF hash, typed name, timestamp и identityVerified=false. Хеш не устанавливает личность.

## Этапы и стоп-условия

1. Этот аудит, источник данных и карта маршрутов.
2. Отдельная защита RoomType от изменения через сохранение квартиры; проверки.
3. Профиль и мобильные формы/карточка гостя; приватные фото, компактный TTLock.
4. Composer: два этапа, inline фото/документ, честный handoff, возврат без потери текста.
5. Настройки и contextual documents/access/payment — без дублирования реквизитов.
6. Kaspi link configuration — отдельное минимальное persistent расширение после подтверждения scope и официального URL format. Никаких amount/orderId без API.
7. Версионируемые комплекты, роли сторон, provider sandbox и юридическая проверка — отдельно; не имитация signing.
8. SMS provider, OTP policy/limits/server verification — отдельно, без платных тестов.
9. Полный CI + authenticated visual QA 320/360/390/430/desktop ru/kk, keyboard/long text/errors/permissions; screenshots/video и Preview.

## Что пока нельзя заявлять проверенным

Полный lint/tsc/build, реальные API/DB сценарии, визуальная QA authenticated routes, банковская сверка, SMS, TTLock hardware commands, провайдер подписания, юридическая применимость. Наличие schema и server code не подтверждает production credentials, migrations applied или работоспособность внешнего сервиса.
