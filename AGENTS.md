# Shanyraq AI — Agent Instructions

Production SaaS platform for Kazakhstan's short-term rental market. Shanyraq helps individual hosts and property-management teams operate apartments, houses, aparthotels, guest houses, and other daily-rental inventory from one mobile-friendly workspace.

The product goal is to become the best operating system for short-term rental businesses in Kazakhstan, not a generic global hotel PMS. Optimize product decisions for local hosts and managers first: fast onboarding, a clear booking calendar, reliable channel synchronization, guest communication, payments and deposits, cleaning operations, and Kazakhstan-specific workflows.

## Product positioning and audience

- Primary customers: Kazakhstan-based short-term rental operators managing roughly 1–100 units.
- Support both individual units and grouped inventory such as several similar apartments or aparthotel rooms.
- Use customer-facing terms such as **property**, **unit**, and **accommodation** where they are clearer than hotel terminology. Existing `Hotel`, `RoomType`, and `Room` database names are legacy implementation details; do not rename them broadly unless a dedicated migration task explicitly requires it.
- Kazakhstan is the default market: KZT, Russian and Kazakh localization, local payment methods, local documents, local time zones, and local support expectations matter.
- Priority distribution channels are Krisha.kz, Booking.com, Airbnb, Ostrovok/Emerging Travel Group, and Bronevik, subject to confirmed partner/API access. Channex is the preferred aggregator for supported global channels; unsupported local channels may require separate adapters.
- RealtyCalendar and similar products are competitive references, not designs to copy. Prefer a simpler, more modern, Kazakhstan-focused experience.

## Product priorities

When choosing between otherwise reasonable implementations, prioritize this order while still building only the feature requested:

1. A fast, mobile-first calendar and reservation workflow.
2. Accurate availability, rates, restrictions, and protection from double bookings.
3. Reliable channel connections and actionable synchronization errors.
4. Direct bookings, KZT payments, prepayments, deposits, and payment tracking.
5. Automated guest messages and a guest stay page.
6. Cleaning, turnover, maintenance, and staff tasks.
7. Revenue, occupancy, channel commission, expense, and profit reporting.
8. Automation that reduces repetitive work for hosts and managers.

Do not prioritize enterprise-hotel features, complex front-desk workflows, or speculative global requirements unless the current feature or a real customer requires them.

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

Modern premium B2B SaaS look: clean, minimal, professional, welcoming, and optimized for short-term rental operations. Mobile use is a first-class requirement because owners, managers, and cleaners work away from a desk. Don't overcomplicate the interface.

Sidebar sections (implement only what's requested per task): Overview, Calendar, Reservations, Properties, Guests, Channels, Tasks, Reports, Settings.

Conceptual product model: Organization → Properties → Units → Listings/Rate Plans → Reservations → Guests → Channels. The current Prisma schema may continue using `Hotel`, `RoomType`, and `Room` internally until a dedicated migration is justified. External channels use separate adapter modules behind a shared contract.

## Process per task

1. Make only necessary changes; keep existing functionality working; don't touch unrelated files.
2. Run lint; run build when appropriate; fix errors before finishing.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
