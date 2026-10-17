# Mobile-first: выполненный этап и проверка

Дата: 2026-10-17. PR #25. База: main, b09db49df61aea83ce5c4d651af3b57ed8017274.

**Статус: частичная реализация, Draft, не готово к merge/production. Полное ТЗ не выполнено.**

## Что изменено

| Было | Стало | Ограничение проверки |
|---|---|---|
| В профиле квартиры весь TTLockWorkspace | Галерея приватных фото, сведения, цена/ночь, описание типа, компактные служебные переходы, календарь/поделиться | SSR и реальные фото требуют authenticated E2E |
| Нет явного редактора профиля | OWNER: отдельный /edit; существующий основной редактор доступен сотруднику с ROOMS | Название, адрес, фото и инструкции используют прежний CommunicationProfile; не создан второй источник |
| Одна квартира могла переписать общие capacity/basePrice | Общее значение наследуется, server action отклоняет изменение существующей категории | Чистая policy проверена; DB regression ещё нужен |
| Технические панели/история загружались в профиле | /access; история квартиры только после explicit query history=1 | TTLock sandbox/remote commands не запускались |
| Данные брони/коды запрашивались в TTLock с одним ROOMS | Дополнительно требуется RESERVATIONS для reservations/passcodes | Требуется отрицательный E2E с ограниченным сотрудником |
| Два mobile edit и закрытие карточки гостя | Один mobile edit, после сохранения остаётся выбранная карточка | Сохранение scroll/tab в реальном приложении не принято |
| Три шага, готовый текст скрыт за редактированием | Сообщение → Проверка; текст сразу editable; необязательные фото/документ | Фотографии и signing panel не покрыты end-to-end |
| Риск назвать системное share отправкой | Честные названия, точный подготовленный текст, ручной выбор приложения/получателя | На fixture нет нативного share; iOS/Android требуется проверить |
| Потеря текста при размонтировании | In-memory draft: user:org:hotel:booking, TTL 15 минут, до 20 записей; clearDeviceData очищает | Не серверное сохранение; reload/новая вкладка/другое устройство не поддерживаются |
| Desktop settings игнорирует section; дубли responsive forms | Единая навигация и один источник реквизитов; старый documents route ведёт в company | Данные settings до сих пор загружаются eager; не заявлено исправление всех performance вопросов |
| Шаблоны требуют отдельного поиска | /communications?tab=templates | Не меняет permissions |

Обычная презентация — текст из явного allowlist: имя, вместимость, базовая цена и общее описание типа. Адрес, приватные фото, Wi-Fi, ключи, бронь, гость и ссылки документов не передаются как поля. Это не новая публичная страница. Произвольный текст, введённый сотрудником в разрешённое описание, не является автоматической классификацией PII: предпросмотр нужно проверять перед передачей.

## Что реально проверено

| Проверка | Результат | Область |
|---|---|---|
| npm run lint | PASS | Только доступная частичная выгрузка исходников, не full-repo CI |
| tsx --test: rooms/*.test.ts, composer-memory.test.ts, draft.test.ts | PASS, 17/17 | 4 policy + 2 public presentation + 3 memory + 8 existing draft tests |
| Strict TypeScript для type-policy.ts, presentation.ts, composer-memory.ts | PASS | Только три независимых pure module |
| tsc --noEmit | НЕ ПРОЙДЕН, exit 2 | Частичная выгрузка: отсутствуют db/guards/access/ui и другие зависимости. Ни ошибки, ни baseline не являются доказательством корректности полного проекта |
| npm run build | НЕ ПРОЙДЕН, exit 1 | module-not-found на отсутствующих исходниках; существующий Prisma/schema gate не отключался |
| Composer fixture 320/360/390/430 px | PASS | Реальные Composer/Sheet/Button/Field/шаблоны/CSS, synthetic data, mocked HTTP; edit→review→back сохраняет текст, empty photos, нет document horizontal overflow/browser page errors |
| Desktop composer fixture 1440px | Отдельный screenshot/fixture | Это не screenshot всего authenticated dashboard |
| Визуальное чтение mobile edit/review screenshots | Выполнено | Убрана бледность вторичного текста, hover primary white contrast исправлен; нет видимого перекрытия в просмотренных состояниях |
| AA пары в новом composer | Checked | #52645a/#f8f8f4: 5.92; white/#07866b: 4.53; white/#06745d hover: 5.73. Не полный accessibility audit |
| GitHub PR check-runs / status | НЕДОСТУПНО, HTTP 403 | PAT не имеет доступа; это не зелёный CI и не утверждение, что CI отсутствует |
| Vercel Preview | НЕ ПОЛУЧЕН | Соединение Vercel требует повторной авторизации |

Fixture подменяет DocumentSigningPanel и LoadFailure; проверки этих компонентов, настоящего API, авторизации, документов/фото и native share из неё не следуют. В архиве доказательств — синтетические скриншоты/видео/логи и test scripts, не production PII. Короткий viewport не равен проверке настоящей экранной клавиатуры.

Команды unit/scoped types:

```sh
npx tsx --test src/lib/rooms/*.test.ts src/lib/communications/composer-memory.test.ts src/lib/communications/draft.test.ts
npx tsc --noEmit --strict --skipLibCheck --target es2017 --module nodenext --moduleResolution nodenext src/lib/rooms/type-policy.ts src/lib/rooms/presentation.ts src/lib/communications/composer-memory.ts
```

## Не выполнено: обязательные продолжения

1. **Kaspi:** нет persistent настроек ссылки, получателя, enabled/scope, валидации и контекстного booking payment-request. Обычная ссылка не обязательно требует bank API, но для неё всё ещё нужны модель/миграция, tenant permissions, аудит и безопасный URL contract. Не выдавать это за зависимость исключительно от API банка. Для банковской сверки/подтверждённых статусов нужны отдельная подтверждённая интеграция и sandbox.
2. **SMS:** не подтверждены провайдер/договор/доступ; OTP, информационная SMS и дверной код должны быть разными сценариями. Нужны consent, rate limit, retry/idempotency, безопасные логи и sandbox. Реальных платных отправок не было.
3. **Документы:** не реализованы immutable версионируемые комплекты, раздельные действия владельца и гостя, aggregate status, одна ссылка на комплект, provider webhooks/replay и подтверждающий пакет. Нужны выбор модели и юридическая проверка, schema/migration и test sandbox. Существующий LINK_TYPED_NAME/identityVerified:false не равен ЭЦП/SMS/проверке личности.
4. **Контекст бронирования:** единый новый блок документы/оплата/доступ не реализован; existing actions не переписаны. Автовозврат из заполнения реквизитов в исходный сценарий требует отдельной реализации. Текст можно восстановить в памяти вкладки, но это не полноценный return-to-origin workflow.
5. **Данные квартиры:** per-unit amenities/description отсутствуют; они требуют явной модели и миграции. Общее RoomType.description помечено как описание типа.
6. **Черновики:** нет серверного сохранения и синхронизации устройств; не перехватываются все варианты browser Back при SPA-навигации. Ссылки/bytes, генерируемые для документов, намеренно не кладутся в память черновика.
7. **Полная приёмка:** не выполнены screenshots всех экранов и состояний, RU/KK длинные тексты, настоящий keyboard, все ошибки API/no-permission, tenant/audit/financial/outbox DB regression, документы/истёкшие/revoked links/provider idempotency и полный production build.

## Порядок безопасного завершения

1. Полный авторизованный checkout в CI или среде разработки; установка по существующему lockfile. Здесь локальный install не считается reproducible repository install, сгенерированный lockfile не публиковался.
2. lint + TypeScript + unit/reliability/signing tests + production build + DB regression на тестовой БД. Не обходить schema/release gates.
3. Authenticated Preview: реальные квартиры/гости с тестовыми данными, права OWNER/ограниченный сотрудник/чужой hotel; width 320/360/390/430/desktop, RU/KK, ошибки, keyboard, offline boundaries.
4. Отдельные малые PR для Kaspi link/persistence и booking context; без ложного PAID.
5. Отдельно юридическая модель, document bundles, owner/guest/provider и sandbox; SMS отдельно, только после provider review.
6. После полной приёмки перевести Draft в ready. До этого не merge, не production deploy.

Production не менялся, миграции не выполнялись, реальные сообщения/платежи/подписи не инициировались. Сохранение tenant isolation и transactional guarantees требует полного регресса, а не только code review этого PR.
