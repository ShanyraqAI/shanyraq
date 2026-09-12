# Shanyraq AI — Agent Instructions

Production SaaS platform for real hotel businesses: hotel management system + channel manager connecting to Booking.com, Ostrovok, Krisha.kz, and other channels.

## Incremental development (critical)

- Build **one feature at a time**. Never implement future functionality unless explicitly requested.
- Never try to build the whole SaaS app in one task.
- If a feature can be implemented simply, choose the simpler solution. Do not over-engineer or create infrastructure for features not currently being built.
- If something is unspecified, make the smallest reasonable implementation.

## Product standard

- Build production-ready functionality for real customers, with persistent data, authorization, validation, tenant isolation, and useful error states.
- Do not label completed product functionality as demo, prototype, mock, or MVP.
- Never substitute browser-only state for business data that must survive across devices or sessions.
- Mock external providers only when their real credentials or API access are unavailable, and make that boundary explicit in the relevant integration screen.
- Authentication and PostgreSQL/Prisma are active parts of the product. Extend them carefully when a requested feature needs them.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Lucide React.
Do not add dependencies unless actually necessary. Persistent data uses PostgreSQL + Prisma migrations.

## Code style

- Simple readable TypeScript, small reusable components, clear naming.
- Avoid huge components, duplicated code, unnecessary abstractions.
- Never hardcode secrets or put credentials in client-side code; use env vars when secrets are introduced.

## UI direction

Modern premium B2B SaaS look: clean, minimal, professional, hotel-focused. Don't overcomplicate the interface.

Sidebar sections (implement only what's requested per task): Overview, Calendar, Reservations, Rooms, Guests, Channels, Reports, Settings.

Core data model: Organization → Hotels → Rooms → Reservations → Channels → Channel Connections; external channels use separate adapter modules.

## Process per task

1. Make only necessary changes; keep existing functionality working; don't touch unrelated files.
2. Run lint; run build when appropriate; fix errors before finishing.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
