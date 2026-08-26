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

The local MVP uses **SQLite** (zero setup). The schema avoids engine-specific
features (no native enums — statuses are strings validated by Zod/TS unions),
so moving to PostgreSQL is:

1. Change `provider = "postgresql"` in `prisma/schema.prisma`
2. Point `DATABASE_URL` at your Postgres instance (see `.env.example`)
3. `npm run db:push && npm run db:seed`

### Security notes

- All mutations go through server actions validated with Zod
- Channel credentials are stored server-side only and never sent to the browser
  or logged; `parseCredentials()` is the single point to swap for an encrypted
  secret store
- Tenant access funnels through `getCurrentHotelId()` — the seam where real
  authentication plugs in later

## Deployment — free demo hosting on Vercel

The app is Vercel-ready: on an empty database it **bootstraps itself** (applies
the schema DDL, then loads the demo dataset inside one transaction — safe
against concurrent cold starts).

### Important SQLite limitation (read this)

Vercel serverless functions have an **ephemeral filesystem**: only `/tmp` is
writable and every cold start begins from an empty file. With
`DATABASE_URL="file:/tmp/shanyraq-demo.db"` this means:

- ✅ the site always renders a complete, fresh demo (seed runs on cold start,
  dates are anchored to "today", so the demo never looks stale)
- ⚠️ **writes are not persistent** — created reservations survive only until
  the instance recycles, and two parallel instances keep separate databases

Honest summary: *Vercel hosting works, but SQLite persistence needs a separate
solution.* For viewing/demo purposes this is fine; for shared interactive use,
add persistence.

### Recommended persistence upgrade (still SQLite, no PostgreSQL migration)

[Turso](https://turso.tech) has a free tier and speaks the same SQLite dialect:

1. Create a database in Turso, get `DATABASE_URL` (libsql://…) + auth token
2. `npm i @prisma/adapter-libsql @libsql/client`
3. In `schema.prisma`: add `previewFeatures = ["driverAdapters"]`
4. In `src/lib/db.ts`: construct `PrismaClient` with the libSQL adapter when
   `TURSO_DATABASE_URL` is set (keep the file fallback for local dev)
5. Push the schema once: `npm run gen:sql`, then apply `DB_INIT_SQL` via the
   Turso shell (or run `db:reset` against a local copy and upload)

Local development stays exactly as it is — plain `file:./dev.db`.

### Steps to deploy

1. Push this repository to GitHub
2. In Vercel: **Add New → Project → Import** the repo (framework auto-detected)
3. Environment variable: `DATABASE_URL = file:/tmp/shanyraq-demo.db`
4. Deploy — first visit auto-provisions the demo data

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
