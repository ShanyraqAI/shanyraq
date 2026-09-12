# Closed beta audit

Audited: 2026-09-11

## Executive summary

Shanyraq is already a working multi-tenant hotel operations application, not a blank starter. The core data model, authentication, hotel-scoped authorization, rooms, guests, reservations, rates, availability, dashboard, calendar, onboarding, billing, audit logging, and channel adapter boundaries exist. Reservation writes already use transactions, PostgreSQL advisory locks, application overlap checks, and a database exclusion constraint.

The beta work therefore extends the current architecture incrementally. Phase 1 reliability gates are complete. Phase 2 analytics and Super Admin are implemented and deployed. Phase 3 activation/onboarding, the lightweight interface tour, closed-beta feature hiding, and the user-to-admin help inbox are implemented, isolated-E2E verified, and have their additive schema deployed to the shared database. Contextual ratings, broader import/export, experiments, and scoped support access remain later phases.

## What exists

| Area | Current state | Beta assessment |
| --- | --- | --- |
| Architecture | Next.js 16 App Router, React 19, TypeScript, Tailwind, shadcn/ui, Prisma/PostgreSQL. Server Components read through Prisma; client components call validated Server Actions. | Suitable for the beta. No platform rewrite is justified. |
| Authentication | Email registration with verification code, phone registration, Google OAuth, password reset, opaque DB-backed sessions, hashed tokens, httpOnly/SameSite cookies, login rate limits. | Strong foundation. Production email/OAuth credentials still need launch validation. |
| Tenant isolation | Memberships bind user, organization, and hotel. Mutations resolve the active hotel from the session. Composite foreign keys prevent cross-hotel room, guest, room-type, rate-plan, and reservation references. | Read-only audit found no cross-hotel rows. Keep hotel predicates mandatory in every new query. |
| Database | Persistent PostgreSQL schema with organizations, users, memberships, hotels, rooms/types, guests, reservations, rates, availability, channels, notifications, billing, sessions, invitations, and audit logs. | Production-oriented. Migrations are present and must be deployed rather than using `db push`. |
| Dashboard | Live KPIs, arrivals/departures, recent reservations and revenue. Queries are hotel scoped and mostly parallelized. | Functional. Channel health and manual synchronization controls are retained in code but hidden while channel integrations are unavailable. |
| Calendar | One continuous 7/14/30-day timeline, URL-backed navigation, date jump, filters, create/edit/cancel flows, drag-and-drop moves, and server-enforced overlap protection. | Phase 1 redesign is implemented. Reads are bounded to the selected visible range and refreshed reservation details are derived from current server data. |
| Reservations | Creation, editing, status transitions, cancellation, pricing, availability recomputation, channel outbox, and audit logs. | Strong concurrency protection. Editing with a newly entered guest was offered by the UI but rejected by validation; Phase 1 fixes it. |
| Rooms | Create/update/status/delete, uniqueness per hotel, billing capacity checks, availability/channel updates. | Functional. Duplicate room numbers are protected in both application logic and the database. |
| Guests | Hotel-scoped create/update and reservation relationships. | Functional. Guest lists are loaded in full in reservation forms and may need searchable pagination at larger beta volumes. |
| Rates/pricing | Rate plans, daily overrides, bulk updates, stay total calculation, hotel currency support. | Functional. |
| Onboarding | Registration creates an organization, placeholder hotel, owner membership, and session. The persistent 1/3 flow then saves property details, creates the first room, and creates or explicitly defers the first reservation before opening the dashboard tour. | Phase 3 implemented, browser-verified on the isolated database, and schema-ready in shared production. |
| Import/export | A deterministic XLSX and public Google Sheets importer already recognizes list and calendar-style sheets, previews rows, validates basic fields, and reports per-row import errors. | Partial relative to Phase 5: no CSV, configurable column mapping, room-create/map choices, comprehensive duplicate preview, selected-field export, or transactional batch strategy. Do not replace the working parser. |
| Analytics | `AnalyticsEvent` records the closed-beta taxonomy with user/organization/hotel/session and optional entity context. Metadata is allowlisted and excludes guest data. | Implemented in Phase 2. Successful auth, hotel, room, reservation, guest, rate and calendar actions are instrumented. |
| Admin | `/superadmin` has explicit `SUPER_ADMIN` authorization, overview metrics, activation funnel, hotel table, and sanitized hotel detail. | Implemented in Phase 2. `OWNER` never implies platform access; assignment remains an explicit operator action. |
| Feedback/tour/beta UI | A short persisted product tour explains Overview, Calendar, Reservations, Rooms, Guests, Rates, and Help. The Help dialog stores a scoped support request for Super Admin. | Phase 3 implemented. Contextual rating and the broader Phase 4 feedback workflow remain intentionally separate. |
| Channel manager | Adapter registry, mappings, queue/outbox, logs, and deterministic mock providers exist. | Customer navigation, direct routes, connection actions, source selection, dashboard health, and sync buttons are closed behind one feature switch until live OTA integrations are ready. No channel code or data was deleted. |

## Phase 1 findings and actions

### Fixed in this phase

1. **Unbounded calendar history read.** The calendar previously loaded every reservation for a hotel on every visit and refresh. It now validates `?date=YYYY-MM-DD&range=7|14|30` and queries only stays where `checkIn < visibleEnd` and `checkOut > visibleStart`. Invalid input falls back to the hotel business date and a 14-day range.
2. **Stale reservation details.** The calendar stored a full reservation snapshot after selection. It now stores the ID and derives the current record from refreshed server data.
3. **Broken new-guest edit path.** The edit UI allowed a new guest but the server schema required an existing guest ID. The validator/action now accept and resolve either choice.
4. **Hotel-day timezone mismatch.** The calendar's initial date, today highlight, and quick-create defaults now use the hotel's configured IANA timezone.
5. **Confusing calendar modes.** Day/week/month navigation has been replaced by one continuous timeline. Previous/Next move by exactly 7, 14, or 30 days; Today preserves the selected range; range switching preserves the anchor; and the human-readable range opens a direct date picker.
6. **Crowded mobile calendar controls.** The compact toolbar keeps navigation and reservation creation visible, moves filters into a bottom sheet with active-filter count/reset/apply controls, and keeps the room column sticky over a horizontally scrollable timeline. The importer now appears only on Reservations.
7. **Dependency advisories.** `sharp` was patched from 0.35.3 to 0.35.4. `js-yaml` was patched from 4.3.1 to 4.3.2 through the ESLint/shadcn tooling trees. `hono` 4.13.4 and `qs` 6.15.3, both transitive through the shadcn CLI's MCP tooling, are overridden to 4.13.7 and 6.16.0. The shadcn CLI is now development-only. These are patch-level updates; Shanyraq does not call the vulnerable shadcn/MCP paths at runtime. Both full and production-only `npm audit` now report zero advisories.
8. **PostgreSQL advisory-lock result compatibility.** Phone registration exposed a Prisma deserialization failure because `pg_advisory_xact_lock` returns PostgreSQL `void`. The rate limiter now casts that result to `text`; the transaction-scoped lock and rate-limit behavior are unchanged. Registration then completed against the isolated PostgreSQL database and the production build passed.
9. **Development CSP error overlay.** The CSP now permits `unsafe-eval` only when `NODE_ENV=development`, which React 19 uses for development call-stack reconstruction. The production CSP remains unchanged and does not contain `unsafe-eval`.
10. **Extension-injected hydration attribute.** The reported mismatch was limited to `data-smart-converter-loaded` on `<body>`, an attribute injected before hydration by a browser extension rather than rendered by Shanyraq. The root body now suppresses this known one-level mismatch; application hydration errors elsewhere remain visible.
11. **Missing mobile month orientation.** Month text was centered across the full horizontally overflowing month segment, placing it outside the initial narrow viewport. The month label is now sticky beside the room column while its month is in view. The two ambiguous corner labels were replaced with the stable column labels “Период” and “Номер”.

### Verified protections

- Active reservations occupy `[checkIn, checkOut)`, so same-day checkout/arrival is allowed.
- Application checks and PostgreSQL `Reservation_no_room_overlap` protect against concurrent active stays in the same physical room.
- Reservation create/update/status mutations are transactional and hotel scoped.
- Duplicate room numbers and room-type names are unique within a hotel.
- The read-only tenancy audit reported 34 rooms, 40 reservations, zero cross-hotel room/reservation relations, zero cross-organization memberships, and zero duplicate room/type groups.

### Remaining Phase 1 risks

- The unrelated billing foreign-key drift remains in both the shared and isolated databases. It was not modified automatically and must be handled in a separately reviewed migration.
- Earlier automated browser screenshots passed at exact 360, 390, 430, 768, and 1024 px viewport widths with no document-level horizontal overflow. After the month-label correction, the available browser was fixed at 1280 px, so a person must verify at those five widths that the month stays visible beside “Период” and “Номер”, plus horizontal timeline swipe, sticky room-column layering, the mobile filter sheet, native date picker, reservation-block readability, and the swipe-versus-drag boundary. Native HTML drag-and-drop should also be verified with a real mouse on desktop.
- Calendar guest options still load all hotel guests. Introduce server-side guest search only if beta volume shows this is material.
- Native HTML drag-and-drop remains desktop-oriented. Touching a reservation disables native drag for that gesture so horizontal swiping does not initiate a move; mobile users can still change the room/dates in the edit dialog. This interaction still needs the manual device check above.
- `today()` is still used by some non-calendar operational pages without the hotel's timezone. Standardize those pages in a later focused stability pass.

### Disposable E2E and browser results

- Created a separate Neon PostgreSQL database named `shanyraq_e2e_test` while connected to the source database as `neondb_owner`. The application launcher derives the test URL in memory, rejects database names that do not end in `_test`, `_dev`, or `_demo`, uses port 3101, and never rewrites or prints the shared `DATABASE_URL`.
- Applied all eight reviewed Prisma migrations to `shanyraq_e2e_test` with `prisma migrate deploy`. The queue migration completed successfully. A post-migration schema diff contains only the three known billing `ON UPDATE CASCADE` differences and no queue-specific difference.
- Completed the production-build browser path with synthetic data: phone registration → hotel details → room 101 → direct reservation for E2E Guest → calendar → 7/14/30 selection → previous/next navigation → native date picker → edit comment → full refresh and persistence check → move dates from 15–17 to 16–18 September 2026 → cancel. The final database row is `CANCELLED`, retains the moved dates and edited comment, and disappears from the active calendar timeline.
- Browser console inspection reported no errors or warnings during the run. Shared `neondb` tables and customer data were not used for E2E writes.
- A final production-build browser check after the CSP/calendar fixes loaded the authenticated calendar from `shanyraq_e2e_test`, showed “Период”, “Сентябрь 2026”, and “Номер”, and reported no browser errors, warnings, or Next.js error dialog. A development-mode browser check also loaded without the prior `eval()` CSP error or hydration overlay.

### Channel-sync migration status and safe deployment

The shared Neon database `neondb` safely applied `20260904000000_channel_sync_queue` on 2026-09-11. Immediately before backup and deployment, the read-only preflight found no `ChannelSyncJob` table, no `ChannelConnection_id_hotelId_key` index, and no corresponding `_prisma_migrations` row, so it was not partially applied. It separately confirmed the three pre-existing billing foreign keys described below.

This was also the root cause of the reported generic reservation-action error: the shared database has connected external channel records, and reservation create/move/cancel commits their channel delivery intent through `ChannelSyncJob`. The missing table caused the whole transaction to roll back. The deployed queue schema now supports that path; the rollback-only post-deployment probe verified the same hotel-scoped foreign keys and status lifecycle without leaving test data behind.

The backup-first gate was satisfied by creating a separate restorable PostgreSQL database copy named `shanyraq_neondb_pre_queue_20260911_backup`. The source and copy both contained 6 users, 6 hotels, 34 rooms, 40 reservations, and 9 applied migration rows. Creating the copy required closing two idle `pgbouncer` sessions after confirming that there were no active or unexpected source sessions; no active query was terminated. The backup retains the exact pre-migration schema and data and was not used by E2E.

The reviewed SQL creates the queue table, queue indexes/check constraints, two queue foreign keys, and one composite unique index on existing channel connections. It contains no `UPDATE`, `DELETE`, table drop, or column rewrite. The composite index is safe because `ChannelConnection.id` is already unique. Before the isolated deployment, the unapplied migration was aligned with the Prisma model by adding `ON UPDATE CASCADE` to the hotel foreign key and removing the unintended default from `updatedAt`. Applying it through Prisma is additive and should not modify existing hotel/user/reservation rows. The raw SQL is not manually idempotent (`CREATE TABLE`/`CREATE INDEX` have no `IF NOT EXISTS`); its safe one-time execution depends on Prisma's migration ledger and the preflight checks below.

`prisma migrate diff` also reports pre-existing drift on the `BillingSubscription`, `BillingPayment`, and `BillingNotice` organization foreign keys: the database has `ON DELETE CASCADE` but omits Prisma's explicit `ON UPDATE CASCADE`. That drift is not contained in the channel-queue migration and will not be changed by `prisma migrate deploy`. Do not use `prisma db push`; reconcile it in a separately reviewed migration before generating unrelated future schema changes.

Executed production procedure and retained operator reference:

1. The intended shared database was identified as `neondb` with role `neondb_owner`. The verified recovery database is `shanyraq_neondb_pre_queue_20260911_backup`. Future migrations must repeat this gate and stop if their own recovery point cannot be verified.
2. From the reviewed release commit, run the exact preflight command:

   ```sh
   npx prisma migrate status
   ```

   Then run these read-only catalog checks against the intended production connection:

   ```sql
   SELECT current_database(), current_user;
   SELECT to_regclass('"ChannelSyncJob"'),
          to_regclass('"ChannelConnection_id_hotelId_key"');
   SELECT migration_name, started_at, finished_at, rolled_back_at
   FROM "_prisma_migrations"
   WHERE migration_name = '20260904000000_channel_sync_queue';
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conname IN (
     'BillingSubscription_organizationId_fkey',
     'BillingPayment_organizationId_fkey',
     'BillingNotice_organizationId_fkey'
   )
   ORDER BY conname;
   ```

   Expected queue preflight: both `to_regclass` values and the migration row are absent. Expected unrelated drift: all three billing definitions have `ON DELETE CASCADE` but no `ON UPDATE CASCADE`. If a queue object exists without the finished migration row, stop and investigate instead of deploying.
3. With the local dev server stopped, the following exact production migration command was run:

   ```sh
   npx prisma migrate deploy
   ```

   Do not run reset, seed, `migrate dev`, or `db push`.
4. `npx prisma migrate status` returned "Database schema is up to date". The migration finished at `2026-09-11T12:43:36.142Z` with no rollback; the queue table/index are present; both queue foreign keys use `ON DELETE CASCADE ON UPDATE CASCADE`. The exact read-only diff below now returns only the separately documented three billing foreign-key changes:

   ```sh
   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
   ```
5. A rollback-only probe against an existing hotel-scoped external connection observed `PENDING → RUNNING → SUCCEEDED` and then intentionally rolled back. It persisted zero rows. The following health check reported 0 total, active, failed, or duplicate queue jobs.
6. If the application rollout fails, roll back the application and leave this additive migration in place. Do not drop the queue table as an incident rollback; restore from the recorded recovery point only if verification shows unexpected data or schema impact.

The migration is now safely applied and verified in both `shanyraq_e2e_test` and shared `neondb`. The separate billing foreign-key drift remains untouched.

## Phase 2 — observability and Super Admin

### Implemented

- Added a nullable, database-constrained `User.platformRole`. Only the exact value `SUPER_ADMIN` is accepted; hotel roles such as `OWNER`, `MANAGER`, and `STAFF` never grant platform access.
- Added the privacy-minimal `AnalyticsEvent` model and indexes by event/time, user/time, organization/time, and hotel/time. The database and TypeScript both constrain the event taxonomy to: `signup_completed`, `hotel_created`, `room_created`, `room_updated`, `reservation_created`, `reservation_updated`, `reservation_cancelled`, `calendar_opened`, `guest_created`, `rate_updated`, `feedback_submitted`, `bug_reported`, and `login`.
- Instrumented successful registration/login, Google authentication, hotel creation, room create/update, reservation create/update/move/cancel, guest creation, bulk rate update, and calendar opening. Analytics writes outside a business transaction fail closed to telemetry and do not turn a successful hotel operation into a user-visible error.
- Metadata accepts only the non-sensitive allowlist `method`, `source`, `status`, and `rangeDays`. The Super Admin hotel detail deliberately omits metadata and never selects password hashes, session hashes, payment data, or channel credentials.
- Added protected `/superadmin` and `/superadmin/hotels/[hotelId]` routes. The authorization check runs in both the route layout and the admin data-access functions. Unauthenticated visitors are redirected to login; authenticated non-admin hotel users receive 404 so the platform surface is not disclosed.
- Added overview metrics for total/new/active users, hotels, rooms, reservations, reservations today, feedback events, and bug reports; a hotel table with owner, counts, registration, last activity, and activation status; and a sanitized detail view with team, aggregate counts, and recent event names.
- Centralized the adjustable activation funnel definitions: signup → hotel → room → first reservation → activity on a later UTC day → event activity in the rolling seven-day window.
- Feedback and bug-report metrics intentionally read the prepared Phase 2 event types. Until Phase 4 adds feedback submission and resolution workflow, their normal value is zero and every future `bug_reported` event is labelled unresolved.
- Added an admin-only link in the normal dashboard for users whose explicit platform role is `SUPER_ADMIN`. Phase 3 onboarding/tour work was not started.

### Database release and recovery

Migration `20260911120000_phase2_observability` is additive: it adds one nullable user column, the analytics table, allowlist checks, indexes, and `ON DELETE SET NULL ON UPDATE CASCADE` analytics foreign keys. It contains no data update, delete, drop, reset, seed, or column rewrite.

The migration was first applied to `shanyraq_e2e_test`. Immediately before shared deployment, the controlled preflight confirmed `neondb`/`neondb_owner`, no analytics table, no platform-role column, and no Phase 2 migration ledger row. It separately reconfirmed that the three billing foreign keys still omit `ON UPDATE CASCADE`.

A new restorable copy named `shanyraq_neondb_pre_phase2_20260911_backup` was created from `neondb` after verifying the only source connection was one idle `pgbouncer` session. Source and copy both contained 6 users, 6 hotels, 34 rooms, 42 reservations, and 10 migration ledger rows. The shared migration finished at `2026-09-11T14:06:07.356Z`; `prisma migrate status` is up to date, the source counts are unchanged, and analytics starts with zero events. The schema diff still contains only the three previously documented billing `ON UPDATE CASCADE` changes, which were not modified.

No production user was automatically elevated because five different users have unexpired sessions and the intended human account cannot be identified safely from that fact. The current production count is therefore zero platform admins. Grant and revoke access only by exact verified email or phone:

```sh
npm run admin:grant -- owner@example.com
npm run admin:revoke -- owner@example.com
```

The script refuses zero or multiple matches and changes only `platformRole`.

### Verification results

- TypeScript and focused ESLint passed. Full ESLint has zero errors and only the three pre-existing unused-symbol warnings in `output/partner-pitch/build/build-deck.mjs`.
- Unit/regression discovery: 45 tests, 42 passed, 3 skipped under the default shared-database-safe run, zero failed. The new tests cover the exact admin role boundary, funnel definitions, event-name allowlisting, and sensitive metadata removal.
- With all destructive integration flags pointed only at `shanyraq_e2e_test`, 16/16 PostgreSQL tests passed, including concurrent reservation writes/moves, direct database overlap enforcement, tenant isolation, spreadsheet import, and billing callback protections.
- `npm run build` passed and emitted both dynamic Super Admin routes plus the analytics API route.
- Real production-build browser verification passed: a normal hotel account received 404 at `/superadmin`; an E2E `SUPER_ADMIN` loaded the overview and hotel detail; opening the 30-day calendar persisted `calendar_opened` with the correct user/hotel/organization and only `{ "rangeDays": 30 }`; the detail view displayed that event; and browser console logs were empty.
- The analytics HTTP regression additionally confirmed status 200 for a valid authenticated same-origin request, status 401 for an anonymous request, and exclusion of an injected `guestEmail` field. A discovered `127.0.0.1` versus internal `localhost` origin mismatch was corrected by accepting only the request origin or configured canonical `APP_URL`.
- The calendar description found during this run now includes the number (`0 номеров`) instead of displaying only the grammatical word form.

Phase 2 code and database release gates are complete. The only operational step remaining before a person can open the production panel is explicitly granting `SUPER_ADMIN` to the intended verified account. The owner subsequently authorized Phase 3 implementation.

## Phase 3 — activation, onboarding, tour, and beta help

### Implemented

- Replaced the property-only onboarding with a persistent three-step path: property essentials → first room/apartment → first reservation. The UI shows 1/3, 2/3, and 3/3 progress; the reservation may be explicitly deferred when the owner has no real booking yet.
- Each transition is revalidated on the server against the authenticated user's current organization/hotel. The final completion cannot be forged without an existing room, and it requires either an existing reservation or the explicit defer choice. Room and reservation creation reuse the existing validated, hotel-scoped business actions.
- Added a short seven-step dashboard tour for full-access users: Overview, Calendar, Reservations, Rooms, Guests, Rates, and Help. Restricted staff see only the sections available to them. Completion and skip timestamps are persisted per user and hotel, so the tour does not reappear after a refresh.
- Added a compact Help dialog in the desktop and mobile navigation. It accepts a question, problem, or suggestion, enforces length and rate limits, derives user/organization/hotel/current page on the server, and stores no cookies, passwords, authorization headers, channel credentials, or guest details. Recent requests and the account contact are visible only in protected Super Admin.
- Added centralized closed-beta availability switches. Channels and subscription/payment remain in the repository but are hidden from navigation. Their direct customer routes redirect to Overview; channel connection/sync actions and billing checkout/status actions reject direct invocation while disabled. Billing enforcement is disabled with the billing feature, so a hidden payment page cannot strand a customer in read-only mode.
- Removed channel source selection and manual sync/health entry points from the active customer workflow while preserving existing reservation source data and the background integration code for a later controlled release.
- Fixed production-mode localhost E2E sessions: cookie `secure` now follows the validated canonical `APP_URL` protocol, remains secure for HTTPS production, and fails closed when a production origin is missing or invalid.

### Database release status

Migration `20260911160000_phase3_onboarding_support` is additive. It creates `ProductExperience` and `SupportRequest`, their indexes, and cascading/nullable foreign keys; it contains no update, delete, table drop, reset, seed, or existing-column rewrite.

The migration was first applied to `shanyraq_e2e_test` with `prisma migrate deploy`; Prisma reported all 10 migrations successfully applied. After the dashboard exposed the expected missing-table error against shared `neondb`, the production gate was repeated on 2026-09-11. Read-only preflight confirmed that both Phase 3 tables and the migration ledger row were absent while the unrelated three billing foreign keys still omitted `ON UPDATE CASCADE`.

A fresh restorable copy named `shanyraq_neondb_pre_phase3_20260911_backup` was created before deployment. Source and backup both contained 6 users, 6 hotels, 34 rooms, 42 reservations, 1 channel-sync job, and the same 11 migration records. Only idle expected `pgbouncer` sessions were closed to create the copy; no active query was terminated. The exact command `npx prisma migrate deploy` then applied only `20260911160000_phase3_onboarding_support` to shared `neondb` and completed at `2026-09-11T16:21:53.157Z` without rollback. `npx prisma migrate status` now reports the database schema is up to date.

Post-deployment catalog checks found both tables and the finished migration row. A transaction-only probe created both record types and intentionally rolled back; it persisted zero rows. User, hotel, room, reservation, and channel-queue counts were unchanged. The billing foreign-key drift remains present and was not modified. Do not use `prisma db push`; reconcile that drift in a separately reviewed migration.

### Verification results

- `npx prisma validate`, `npx tsc --noEmit`, and `npm run build` passed. Full ESLint passed with zero errors and the same three unrelated warnings in `output/partner-pitch/build/build-deck.mjs`.
- Default-safe regression discovery: 45 tests, 42 passed, 3 PostgreSQL suites skipped because destructive flags were not enabled against the shared database, zero failed.
- Production-build browser E2E passed on `shanyraq_e2e_test`: phone registration → property details → first room → first reservation → persisted dashboard data → automatic product tour. Completing the tour and refreshing did not show it again; skip persistence was also verified.
- With both features disabled, the desktop/mobile navigation contained no Channels or Subscription/Payment links, and direct visits to both routes returned to Overview. The 390 px mobile navigation and Help dialog were visually inspected without overflow. The help form validation enabled submission only after a meaningful message; no synthetic message was sent to the Super Admin inbox during visual verification.
- The isolated Neon endpoint was intermittently slow/unreachable for separate one-off CLI probes, but the migration deployment and the complete browser-backed write/read flow both succeeded. The later shared deployment added only the reviewed schema objects and migration record; its rollback-only verification persisted no product or support row.

Phase 3 code and database gates are complete. The remaining release gate is a short owner acceptance check of the 360/390/430/768/1024 layouts on real touch devices.

## Phase 3 follow-up — guests, exports, granular access, and price bounds

### Implemented

- Added a visible `Добавить гостя` action and persistent hotel-scoped guest form to the Guests screen. Existing guest history/editing remains unchanged.
- Added tenant-scoped exports for Calendar, Reservations, and Guests. Calendar export requires an inclusive date range and is limited to 367 days; every export is limited to 10,000 rows. Authenticated users need the matching section permission. Anonymous requests return 401 and cross-section requests return 403.
- Added Excel (`.xlsx`) output with typed dates/numbers, fixed column widths, banded rows, filters, frozen headers, print settings, and a title/scope line. CSV output is UTF-8 with BOM, semicolon-delimited for regional Excel compatibility, and neutralizes spreadsheet-formula prefixes.
- Replaced the legacy employee access choice with checkboxes for Overview, Calendar, Reservations, Rooms, Guests, Rates, and Reports. Full access can be selected in one action and displays a trust warning. The same permissions control sidebar visibility, product-tour steps, page routes, server actions, and export endpoints.
- Existing memberships with an empty permissions array continue to use their legacy `OVERVIEW`, `CALENDAR`, or `FULL` access. Custom combinations use the legacy `OVERVIEW` marker only for database-check compatibility; the non-empty permissions array is authoritative and does not broaden access.
- Centralized the nightly-price range at 1,000–999,000 KZT for onboarding rooms, room editing/creation, new rate plans, and bulk rate updates. Validation runs in both the UI and server schemas. Compact tariff cells now preserve sub-thousand historical values instead of rendering them as `0k`.

### Database release and recovery

Migration `20260911180000_granular_access` adds only non-null `TEXT[]` permission columns with empty-array defaults to `Membership` and `HotelInvitation`. It contains no update, delete, drop, reset, seed, or existing-column rewrite.

The migration was first applied successfully to `shanyraq_e2e_test`. Shared-database preflight then confirmed `neondb`/`neondb_owner`, no permission columns, no migration ledger row, 6 users, 6 hotels, 34 rooms, 42 reservations, 8 memberships, and 0 invitations. It separately reconfirmed that the three billing foreign keys still omit `ON UPDATE CASCADE`.

A restorable database copy named `shanyraq_neondb_pre_access_20260911_backup` was created after confirming that the only source connection was one idle expected `pgbouncer` session. Source and backup counts and all 12 pre-release migration records matched. `npx prisma migrate deploy` then applied only the granular-access migration to shared `neondb`, finishing at `2026-09-11T17:27:09.102Z` without rollback. Post-deployment checks found both columns as non-null arrays with empty-array defaults, 13 migration records, and unchanged product row counts. A transaction-only permissions write/read probe succeeded and intentionally rolled back with zero persisted changes. `npx prisma migrate status` reports that the database is up to date.

The exact schema diff still contains only the three previously documented billing foreign-key `ON UPDATE CASCADE` changes. They remain unrelated and untouched.

### Verification results

- Prisma schema validation, TypeScript, production build, and full ESLint passed. ESLint still reports only the same three unrelated unused-symbol warnings in `output/partner-pitch/build/build-deck.mjs`.
- Focused unit tests passed for legacy/granular access resolution, price boundaries and compact formatting, XLSX structure and typing, UTF-8 CSV output, and formula-injection neutralization.
- Production-build export E2E on `shanyraq_e2e_test` loaded all three generated XLSX files with ExcelJS, verified tenant row counts, filters and frozen headings, verified CSV bytes, and rejected an anonymous export.
- Granular-access E2E created a temporary isolated employee scope with only Calendar and Guests. The allowed page/export succeeded, Reservations was server-redirected/forbidden, and denied navigation links were absent. The temporary session and membership were removed or restored after the test.
- Real browser inspection confirmed the Guests toolbar/add form, both export format choices, all seven access checkboxes, the full-access warning, and 1,000/999,000/500 min/max/step attributes on the rate form. No shared customer records were created or edited during browser verification.

## Proposed database changes by phase

Do not combine these into one migration.

### Phase 2 — observability and Super Admin (implemented 2026-09-11)

- Add an explicit platform-admin authorization mechanism (prefer a dedicated platform role/allowlist model, never infer admin from a hotel role).
- Add `AnalyticsEvent`: `id`, optional `userId`, optional `organizationId`, optional `hotelId`, constrained `eventType`, optional entity type/ID, small non-sensitive metadata JSON, session identifier, and `occurredAt`; index by event/time, user/time, and hotel/time.
- Add or derive daily activity aggregates only after event volume justifies them.

### Phase 3 — activation and onboarding (implemented and schema-deployed 2026-09-11)

- `ProductExperience` stores per-user/per-hotel setup progress, completion, tour completion/skip, first-seen, and last-seen timestamps. Funnel stages continue to derive from real hotel/room/reservation/event existence.

### Phase 4 — feedback

- Add `Feedback`: user/hotel references, category, message, source path, sanitized technical context JSON, rating fields when applicable, status, timestamps, and resolver metadata.

### Phase 5 — migration

- Add import job/batch records only if resumability and audit requirements cannot be met by the existing audit log. Store normalized validation results, not original files indefinitely by default.

### Phase 6 — experiments

- Record future-feature interest as analytics events initially. Add a separate interest table only if users need to edit preferences or admins need durable deduplicated counts independent of event retention.

### Phase 7 — support

- Add `SupportAccessGrant` and `SupportSession` with explicit grantor, hotel scope, reason, expiry, revocation, support actor, start/end, and immutable audit records. Never implement a global invisible impersonation cookie.

## Implementation order and likely modules

1. Finish Phase 1 verification: calendar/reservation services, validation, dates, focused tests, browser workflow on a disposable environment.
2. Phase 2: Prisma schema/migration, analytics service, event call sites, protected `src/app/superadmin`, admin queries/components.
3. Phase 3: onboarding route/components, room/reservation handoff, tour component, per-user product state (implemented, isolated-E2E verified, and production schema deployed).
4. Phase 4: feedback schema/actions/components and Super Admin feedback views.
5. Phase 5: extend `src/lib/reservations` parser/validator/import service, add CSV and export routes/actions, preserve deterministic validation.
6. Phase 6: coming-soon UI plus analytics interest events.
7. Phase 7: support grant/session services, scoped authorization context, and audit UI/documentation.

Every phase should ship with a separate migration where needed, tenant-isolation tests, focused behavior tests, lint, TypeScript, and a production build.

## Phase 1 verification status

- TypeScript: `npx tsc --noEmit` passed.
- ESLint: `npm run lint` passed with zero errors; three unrelated, pre-existing unused-symbol warnings remain in `output/partner-pitch/build/build-deck.mjs`.
- Regression tests: 40 discovered, 37 passed, 3 PostgreSQL integration suites skipped because their destructive test flags were intentionally not enabled against the shared database. New coverage includes all three range shifts, month/year/leap-year boundaries, invalid URL fallback, anchor preservation, hotel-timezone Today, overlap/checkout boundaries, new-guest reservation editing, and refreshed selection.
- Production build: `npm run build` passed and produced a new `.next/BUILD_ID`.
- Install/security: `npm ls --all` passed. `npm audit` and `npm audit --omit=dev` both report 0 vulnerabilities across all severities.
- Database release gate: shared `neondb` is up to date. The queue migration is finished and verified after a matching pre-migration backup copy; queue health is clean. The schema diff now contains only the three unrelated billing `ON UPDATE CASCADE` changes.
- Isolated database: all eight migrations applied to `shanyraq_e2e_test`; the queue schema has no remaining diff and the billing drift remains untouched.
- E2E: the complete beta-critical browser flow passed with synthetic data and ended in a persisted `CANCELLED` reservation. Exact viewport screenshots passed at 360/390/430/768/1024 px.
- Data safety: no reset, destructive seed, `db push`, customer-data mutation, or automatic billing-drift modification was performed. The only persistent shared-database changes were the verified pre-migration backup copy and the additive queue migration. Phase 2 can be unlocked after the owner accepts the remaining real-device responsive/touch/drag checklist.
