# Shanyraq AI — Hotel PMS & Channel Manager (MVP)

Shanyraq AI is a SaaS platform for hotels: a property management system (rooms,
reservations, guests, rates) with a built-in channel manager that keeps
Booking.com, Ostrovok, Krisha and direct sales synchronized through a single
normalized core.

## Quick start

```bash
npm install          # also runs `prisma generate`
npm run db:reset     # creates the SQLite database + seeds demo data
npm run dev          # http://localhost:3000 → redirects to /dashboard
```

> Requires Node.js 18+. If `node`/`npm` are not on PATH, install Node LTS or add
> your Node folder to PATH.

## Scripts

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Development server                                  |
| `npm run build`     | Prisma generate + production build                   |
| `npm run lint`      | ESLint                                              |
| `npm run db:push`   | Sync `prisma/schema.prisma` to the database          |
| `npm run db:seed`   | Seed demo data                                       |
| `npm run db:reset`  | Reset database + reseed (restores the demo dataset)  |
| `npm run test:smoke`| Business-logic smoke test (sync + overbooking guards)|

## Demo dataset

- **Hotel:** Shanyraq Hotel Astana (Asia/Almaty, KZT)
- **Rooms:** 101–103 Standard · 201–203 Deluxe · 301–302 Suite
- **26 reservations** anchored around *today*: past stays, in-house guests,
  today's arrivals & departures, upcoming bookings, a pending and a cancelled one
- Rate plans with a 45-day price calendar (weekend pricing), availability rows
- Booking.com + Ostrovok pre-connected with room/rate mappings and sync history;
  Krisha left unconnected so you can run the full connect → map → sync flow

## The MVP demo flow

1. Open `/dashboard` — KPIs are computed live from reservations (occupancy,
   arrivals/departures today, MTD revenue, rooms available tonight)
2. Open the **Calendar** — week-view timeline; click blocks for details,
   click empty cells to create bookings, drag blocks to move them
3. Create a reservation — the calendar, dashboard and reservation list all update
4. Open **Channels** — see Booking.com / Ostrovok connected, Krisha not connected
5. Click **Connect** on Krisha — test credentials (mock), save, then map rooms
   and rates to Krisha's external catalogue
6. Hit **Sync** — reservations are imported through the adapter, availability
   and rates are pushed back, and a sync log is recorded
7. Open the channel's **Logs** page for the synchronization history

## Architecture

```
                ┌─────────────── Shanyraq Core ───────────────┐
                │  Hotel · Rooms · Reservations · Rates ·      │
                │  Guests · Availability                       │
                └───────┬───────────────┬───────────────┬─────┘
                        │               │               │
                 BookingAdapter  OstrovokAdapter  KrishaAdapter      ← lib/channels/providers/*
                        │               │               │
                  External APIs  External APIs  External APIs        ← mocked for the MVP
```

Key principle: internal models never know about channel-specific shapes.
Every channel implements the same `ChannelProvider` interface
(`src/lib/channels/types.ts`); mock providers simulate latency, credential
checks and incremental reservation feeds deterministically. Swapping in real
APIs later means implementing `RealXProvider` and registering it in
`provider-registry.ts` — nothing else changes.

Synchronization (`src/lib/channels/sync-service.ts`) runs per connection:
verify → pull → normalize → overbooking guard → store → push rates → push
availability → record `SyncLog`. The function is job-shaped so a queue/worker
can wrap it without touching callers.

Overbooking protection lives in `src/lib/reservations/service.ts`: demand is
refused when a type is sold out, physical room double-booking is impossible,
and inventory can never go negative.

### Data model (Prisma)

`Hotel → RoomType → Room`, `Guest`, `Reservation`,
`RatePlan → Rate`, `Availability`,
`Channel → ChannelConnection → ChannelRoomMapping / ChannelRateMapping / SyncLog`,
plus `Organization/User/Membership`, `Notification`, `AuditLog` for the next stage.
See `prisma/schema.prisma`.

### Dates & timezones

Hotel business dates are stored as UTC midnights and handled exclusively
through `src/lib/dates.ts` helpers — check-in days can never shift due to
timezone conversion. The hotel's IANA timezone is stored on the hotel record.

### Database provider

Продакшен использует **PostgreSQL (Neon)**. Схема не использует engine-specific фичи (статусы — строки, валидация через Zod/TS), поэтому локально можно было использовать SQLite, но сейчас проект полностью на PostgreSQL:

1. `provider = "postgresql"` в `prisma/schema.prisma`
2. `DATABASE_URL` — Neon connection string (см. `.env` / `.env.example`)
3. `npm run db:push && npm run db:seed`

Локальные `*.db` файлы удалены, `src/lib/db-init-sql.ts` и `gen:sql` больше не нужны — схема управляется `prisma db push`.

### Security notes

- All mutations go through server actions validated with Zod
- Channel credentials are stored server-side only and never sent to the browser
  or logged; `parseCredentials()` is the single point to swap for an encrypted
  secret store
- Tenant access funnels through `getCurrentHotelId()` — the seam where real
  authentication plugs in later

## Deployment — Vercel + Neon PostgreSQL

Приложение готово к деплою на Vercel с Neon PostgreSQL (персистентность, сессии не теряются при холодных стартах).

### Шаги деплоя

1. Push репозиторий в GitHub
2. В Vercel: **Add New → Project → Import** репозиторий (framework auto-detected)
3. Environment variables:
   - `DATABASE_URL` — pooled connection string из Neon Console (`postgresql://...?sslmode=require`)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — из Google Cloud Console (Authorized redirect URI: `https://<vercel-app>.vercel.app/api/auth/google/callback`)
4. Deploy — схема применяется `prisma db push` (или `prisma migrate`), затем `src/lib/bootstrap.ts` сидирует системные `Channel` один раз
5. Проверьте логи: не должно быть `Session table does not exist` — bootstrap больше не зависит от SQLite DDL

## Project layout

```
src/
  app/dashboard/…        overview, calendar, reservations, rooms, guests,
                         rates, channels (+ [channel], logs), reports, settings
  components/
    calendar/            interactive timeline board
    channels/            cards, connect dialog, mapping editor, sync buttons
    dashboard/ guests/ rates/ reservations/ rooms/ settings/ shared/ ui/
  lib/
    channels/            provider interface, mock providers, registry, sync
    availability/ reservations/   domain services
    db.ts stats.ts dates.ts constants.ts types.ts utils.ts
  server/actions/        Zod-validated server actions
prisma/                  schema + seed
scripts/smoke.ts         business-logic smoke tests
```
