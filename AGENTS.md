# Shanyraq AI — Agent Instructions

SaaS platform for hotels. Long-term goal: hotel management system + channel manager connecting to Booking.com, Ostrovok, Krisha.kz, and other channels.

## Incremental development (critical)

- Build **one feature at a time**. Never implement future functionality unless explicitly requested.
- Never try to build the whole SaaS app in one task.
- If a feature can be implemented simply, choose the simpler solution. Do not over-engineer or create infrastructure for features not currently being built.
- If something is unspecified, make the smallest reasonable implementation.

## Current stage

Building the basic dashboard UI: dashboard layout, sidebar, header, overview page, demo data.

Do NOT implement until explicitly requested:
- Authentication (and never create fake auth systems)
- Database / Prisma
- Real API integrations (Booking.com, Ostrovok, Krisha.kz)
- Payments
- Channel sync / adapters
- AI features

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Lucide React.
Do not add dependencies unless actually necessary. When DB is introduced later: PostgreSQL + Prisma.

## Code style

- Simple readable TypeScript, small reusable components, clear naming.
- Avoid huge components, duplicated code, unnecessary abstractions.
- Never hardcode secrets or put credentials in client-side code; use env vars when secrets are introduced.

## UI direction

Modern premium B2B SaaS look: clean, minimal, professional, hotel-focused. Don't overcomplicate the interface.

Sidebar sections (implement only what's requested per task): Overview, Calendar, Reservations, Rooms, Guests, Channels, Reports, Settings.

Future data model (context only, don't build yet): Organization → Hotels → Rooms → Reservations → Channels → Channel Connections; external channels via separate adapter modules.

## Process per task

1. Make only necessary changes; keep existing functionality working; don't touch unrelated files.
2. Run lint; run build when appropriate; fix errors before finishing.
