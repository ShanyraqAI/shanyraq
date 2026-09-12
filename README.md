# Shanyraq AI — Hotel PMS & Channel Manager

Production SaaS for hotel operations: organizations and hotels, rooms, guests,
reservations, rates, availability, access control and a channel-manager core.

## Requirements

- Node.js 20.9 or newer
- PostgreSQL (production uses Neon)
- Environment variables copied from `.env.example`

## Local start

```bash
npm install
npm run db:migrate
npm run dev
```

Database resets are intentionally blocked unless the explicit disposable-database
guards in `.env.example` are configured. Never run `db:reset` against shared or
production data.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Generate Prisma Client and create a production build |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Apply committed Prisma migrations |
| `npm run db:seed` | Seed required reference data |
| `npm run db:seed:demo` | Seed disposable demo data (guarded) |
| `npm run db:reset` | Reset a disposable database (strictly guarded) |
| `npm run db:check:channel-secrets` | Count legacy and encrypted channel credentials |
| `npm run db:migrate:channel-secrets` | Encrypt legacy channel credentials and erase plaintext |
| `npm run test:smoke` | Run destructive business smoke tests on a disposable database |
| `npm run test:room-tenancy` | Audit room tenant isolation |

## Production configuration

Set every applicable variable from `.env.example` in Vercel. In particular:

- `DATABASE_URL` — pooled PostgreSQL connection string.
- `APP_URL` — canonical HTTPS origin of the production application.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — optional Google OAuth.
- `RESEND_API_KEY`, `EMAIL_FROM`, `VERIFICATION_CODE_SECRET` — email code
  verification and hotel invitations.
- `CHANNEL_CREDENTIALS_ENCRYPTION_KEY` — stable 32-byte key; rotating it requires
  decrypting and re-encrypting existing channel credentials.
- `BLOB_READ_WRITE_TOKEN` — private server token for avatar uploads.

Deployments apply schema changes with `prisma migrate deploy`; do not use
`prisma db push` in production. After introducing the encryption key for an
existing database, run `npm run db:migrate:channel-secrets` once from a trusted
environment before enabling channel synchronization.

## Security model

- Email accounts become active only after a short-lived six-digit verification
  code is confirmed. Codes are HMAC-hashed, rate-limited and attempt-limited.
- Sessions and tenant access are checked server-side. Memberships belong to an
  organization and a concrete hotel.
- Tenant ownership is enforced both in service queries and with composite
  PostgreSQL foreign keys.
- Reservation writes use database transactions and advisory locks to prevent
  concurrent overbooking.
- Channel credentials are encrypted with AES-256-GCM and are never returned to
  browser code or written to application logs.
- Avatar uploads validate actual PNG/JPEG signatures and dimensions before they
  are stored in Vercel Blob.
- Unknown server errors return a generic incident identifier; details remain in
  server logs.

## Channel providers

The normalized channel interface and persistence flow are production-oriented,
but Booking.com, Ostrovok and Krisha provider adapters remain deterministic mock
implementations until official API credentials and provider certification are
supplied. The UI must present that boundary clearly; mock adapters must never be
described as a live third-party connection.

## Verification before release

```bash
npm run lint
npx tsc --noEmit
npm run build
npm audit
npx prisma migrate status
npm run db:check:channel-secrets
```
