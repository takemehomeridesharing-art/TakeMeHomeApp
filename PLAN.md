# Take Me Home — MVP v1 build plan

This is the working plan. The contract is the Definition of Done in the build brief (the
acceptance walkthrough is scripted in the README).

## Key decisions

| Topic | Decision | Why |
|---|---|---|
| Package manager | pnpm workspaces, `node-linker=hoisted` | Metro/Expo is happiest with a flat `node_modules` in a monorepo. |
| TypeScript | `~6.0` everywhere (Expo SDK 57 template version), `strict` | One compiler version for all packages; typescript-eslint supports it. |
| Mobile | Expo SDK 57, Expo Router, Zustand, TanStack Query, reanimated, react-native-svg, react-native-maps (OSM tiles) | As briefed. `TripMap.native.tsx` / `TripMap.web.tsx` platform split; web is an SVG schematic. |
| API | Fastify 5 + Prisma 6 (SQLite dev) + Zod + Socket.IO + @fastify/jwt | Prisma 6 keeps `url = env(...)`; schema uses only types that exist on Postgres (enums, Json, DateTime, Float). |
| Contract | Zod schemas for every request/response live in `packages/shared/src/api` | API parses with them; mobile + admin get the inferred types. Zod is the only runtime dep of `shared`. |
| Shared consumption | `shared` is consumed as TS source (`main: src/index.ts`) | No build step; Metro, Vite, tsx and Vitest all transpile it. |
| Rounding | `round10` rounds **down** to the nearest RWF 10 | Rounding is never in the driver's favour, which keeps the no-profit invariant exact for every segment length. |
| Distances | Places graph (15 Kigali points + road links, km = haversine × 1.3 road factor). Corridor = Dijkstra shortest path; driver toggles stops and can add nearby "via" places. | Deterministic, testable, leaves a seam for real routing / geo-radius matching later. |
| Daily limit | ≤ 2 non-cancelled trips per driver per **Kigali calendar day of departure** (UTC+2). | "One out, one back." Checked inside the publish transaction. |
| Recurring trips | Publishing with `recurringDays` creates dated occurrences for the next 7 days sharing a `seriesId`; every occurrence is checked against the daily limit. | A booking is always for a concrete date; recurring stays a convenience. |
| Seats | Segment-aware capacity: for every leg of the corridor, accepted + booked passengers covering that leg ≤ seatsOffered. | A seat freed at Kimisagara can be re-used further along. |
| Payments | `PaymentProvider` interface; `MockMomoProvider` simulates the USSD push (2 s delay → `momo:prompt` socket event → dev Approve/Decline control → provider webhook). | Payment service only sees initiate → webhook → confirm/fail. |
| Messaging | `SmsProvider` / `PushProvider` interfaces; mocks log to console and the `DevOutbox` table (shown in admin). | Same seam pattern as payments. |
| Admin auth | Admin is a `User` with `isAdmin`, logs in with phone + OTP like everyone else. | No passwords to store. |
| Dev runner | `scripts/dev.mjs` spawns API + admin with prefixed logs and Expo with the real TTY (so the QR code prints). | One command, usable QR. |

## JoinRequest / Booking state machine

```
JoinRequest:  pending ──accept──▶ accepted ──payment confirmed──▶ (Booking created)
                 │ │                  │
                 │ └─decline──▶ declined
                 ├─passenger cancel─▶ cancelled ◀── passenger cancel (accepted, unpaid)
                 └─trip starts / trip cancelled──▶ expired ◀── trip starts unpaid
Booking:      confirmed ──trip completed──▶ completed
                  ├──driver marks no-show──▶ no_show
                  └──trip cancelled by driver──▶ refunded (Payment → refunded)
Payment:      initiated ──webhook ok──▶ confirmed   (creates Booking, idempotent)
                  └──webhook fail──▶ failed   (request stays accepted; passenger may retry)
Trip:         published ⇄ full ──start──▶ in_progress ──complete──▶ completed
                  └──cancel (published/full)──▶ cancelled
```

Transitions live in `packages/shared/src/stateMachine.ts` (pure, tested); the API applies them
inside Prisma transactions and rejects anything else with `409 INVALID_TRANSITION`.

## Milestones

- **M0** scaffold, workspace scripts (`dev`, `test`, `typecheck`, `lint`)
- **M1** `packages/shared`: types, fare engine, matching engine, corridor/graph, state machine, API contract — Vitest
- **M2** `apps/api`: Prisma schema + migration, seed, auth, all routes, realtime, providers, integration tests
- **M3** mobile foundation + auth + passenger flow (map home, search, detail, request, MoMo, ticket, track)
- **M4** driver flow (vehicle, publish with live preview, dashboard, realtime requests, ledger, start/complete)
- **M5** safety (SOS, report, block, women-only) + ratings + notifications + chat
- **M6** admin dashboard
- **M7** polish, empty states, README + scripted acceptance walkthrough, full verification

Parallelism: shared + API first (they define the contract), then the admin dashboard and the
mobile passenger/driver flows are built in parallel on top of the mobile foundation.
