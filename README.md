# Take Me Home

**Public carpooling for Rwanda.** A driver who is *already* going from A towards B publishes
the trip and the seats they have free. Passengers going roughly the same way find trips whose
**route corridor** covers their journey (in the right direction), **request to join**, and —
once the driver accepts — pay a **capped cost contribution** with MoMo. Never a fare: the
driver can't profit, and the platform earns only a flat booking fee.

Co-founders: Gisagara Boris and Sugira Aime Serge.

| | |
|---|---|
| `apps/mobile` | Expo SDK 57 · React Native · Expo Router · Zustand · TanStack Query · Reanimated · react-native-svg · react-native-maps (OSM tiles) |
| `apps/api` | Node 20+ · Fastify 5 · Prisma 6 (SQLite in dev) · Zod · Socket.IO · JWT (phone + OTP) |
| `apps/admin` | React 19 · Vite · TypeScript — desktop-first operations dashboard |
| `packages/shared` | Pure TypeScript: domain types, **fare engine**, **corridor matching engine**, API contract (Zod) — Vitest |

---

## Quickstart

Requirements: **Node 20+** and **pnpm 10** (`corepack enable` gives you pnpm).

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts everything in one terminal:

| What | Where |
|---|---|
| API (auto-migrates, seeds an empty DB) | http://localhost:4000 |
| Admin dashboard | http://localhost:5173 |
| Expo dev server (QR code for Expo Go; press **w** for the web preview) | http://localhost:8081 |

* **On a phone:** install **Expo Go**, be on the same Wi-Fi as your computer, scan the QR code.
  The app finds the API automatically at `http://<your-computer's-LAN-IP>:4000` (from the Expo
  host). Override with `EXPO_PUBLIC_API_URL=http://192.168.x.y:4000 pnpm dev` if needed, and allow
  port 4000 through your firewall.
* **Web preview:** press `w` in the Expo terminal (or open http://localhost:8081).
* **OTP is always `123456` in dev** (also printed in the API log). The login screen lists the seeded accounts.

Other scripts:

```bash
pnpm test        # shared engine unit tests + API integration tests
pnpm typecheck   # tsc --noEmit in every package
pnpm lint        # ESLint across the monorepo
pnpm db:reset    # wipe + re-seed the dev database (seeded trips are relative to "tomorrow")
pnpm dev --no-mobile      # API + admin only
pnpm e2e                  # scripted acceptance walkthrough (needs `pnpm dev` running)
```

> Seeded trips are dated **tomorrow** relative to when the database was seeded. If you come back
> to a database seeded days ago, run `pnpm db:reset`.

## Test accounts

All use OTP **`123456`**.

| Phone | Name | Role | What's set up |
|---|---|---|---|
| `+250 788 000 002` | Claudine Uwimana | Driver (♀) | Silver Toyota Corolla `RAD 123 A`. **Nyamirambo → Kimisagara → Nyabugogo → CBD tomorrow 07:00**, 3 seats; return trip CBD → Nyamirambo 17:30 (two-trip meter 2/2). **Grace's pending request** is on her dashboard. |
| `+250 788 000 003` | Aline Mukamana | Driver (♀) | White Toyota RAV4. **Kanombe → Giporoso → Remera → Kimihurura → CBD, women-only**, tomorrow 07:15. |
| `+250 788 000 004` | Jean-Paul Habimana | Driver (♂) | Blue Hyundai Kona Electric (**EV** → RWF 100 booking fee). **Remera → Kimihurura → Kacyiru**, weekdays 08:00 (recurring). Completed trip with Eric yesterday — rate him. ID verification waiting in the admin queue. |
| `+250 788 000 005` | Grace Ingabire | Passenger (♀) | Trusted contact set. Pending request Nyabugogo → CBD on Claudine's trip. Can see women-only trips. |
| `+250 788 000 006` | Eric Nshuti | Passenger (♂) | Completed booking `TMH-K7Q2` with Jean-Paul, **ready to rate**. |
| `+250 788 000 001` | Take Me Home Admin | Admin | Admin dashboard login. |

Any other Rwandan number (`07[2389]x xxx xxx`) signs up a new account.

---

## Acceptance walkthrough (the Definition of Done)

1. `pnpm install && pnpm dev`.
2. **Phone (Expo Go):** sign up with a new number, e.g. `0781234567` → OTP `123456` → enter your
   name (optionally gender + a trusted contact phone, e.g. `0788999888`, so SOS has someone to text).
3. **Rides** tab → From **Kimisagara**, To **CBD**, *Tomorrow* → **Claudine Uwimana · Nyamirambo → CBD 07:00**
   is the top match with a cost share of **RWF 460** + RWF 150 booking fee.
4. Open the trip. In the corridor stop list, tap **Nyabugogo** as your drop-off: the contribution
   breakdown recomputes live (3.6 km → **RWF 270** cost share). Put it back to CBD (6.2 km → RWF 460).
5. **Request to join** → the request screen shows *Waiting for Claudine*.
6. **Web preview** (press `w`, or http://localhost:8081 in a browser): log in as **Claudine**
   (`+250 788 000 002`, OTP `123456`) — accounts with a car start in Driver mode (switch modes in
   **Profile**). The **My Trip** dashboard shows the request appear in
   realtime (alongside Grace's) with the passenger's board point and contribution. **Accept** it.
7. **Phone:** the request flips to *Accepted* in realtime → **Pay with MoMo** → after ~2 s the
   simulated MTN MoMo USSD prompt appears → **Approve** → the **ticket** with trip code
   (`TMH-XXXX`), stops, stat chips, *Guaranteed Ride Home* note, share-with-trusted-contact and
   message-driver actions.
8. Open **Track** → tap **SOS** → confirm. The app shows the alert was sent; the API terminal
   logs `📱 [mock SMS → +250…] TAKE ME HOME SOS: …` and the admin dashboard flags it.
9. **Web (Claudine):** **Start trip** → **Complete trip**. Her ledger shows trip cost / recovered /
   share she still carries.
10. **Both sides rate each other:** the phone gets a *Rate your trip* prompt (stars + tags);
    Claudine rates her passenger from the trip screen.
11. **Admin** — http://localhost:5173, log in as `+250 788 000 001` / `123456`: the new user, the
    trip, the booking, the payment, both ratings and the **SOS event** (plus the mock SMS in
    *Outbox*) are all there.
12. In admin → **Users**, **Suspend** the new passenger. Back on the phone, try to request a seat
    on another trip (e.g. Claudine's CBD → Nyamirambo return trip at 17:30): the app shows
    *"Your account is suspended…"* (API: `403 ACCOUNT_SUSPENDED`).

### Run it automatically

The whole walkthrough above is scripted with Playwright against the real UIs (a new passenger on
the mobile web preview, Claudine on the web preview, and the admin dashboard):

```bash
pnpm db:reset && pnpm dev          # terminal 1
pnpm exec playwright-core install chromium   # once (or set CHROME_PATH to a Chromium binary)
pnpm e2e                           # terminal 2 — prints each step and saves screenshots
```

The API side of the same flow is also covered headlessly by the integration tests
(`apps/api/test/joinFlow.test.ts`).

---

## How it works

### The three rules, in code

1. **The trip pre-exists the passenger.** Only `POST /trips` creates trips. A passenger can only
   create a `JoinRequest` on an existing, published trip.
2. **The driver can never profit.** `packages/shared/src/fare.ts`:

   ```
   costShare = round10(300 RWF/km × segmentKm ÷ (seatsOffered + 1))   // driver counts as an occupant
   bookingFee = 150 RWF (100 RWF for EV/hybrid)                         // platform revenue, never the driver's
   ```

   `round10` rounds **down**, so rounding can never tip a driver into profit. Prices are
   computed server-side from the corridor; the publish and join APIs have no price field. A
   property test checks *recovered < trip cost* over thousands of random feasible seat/segment
   combinations, and an API test sells every seat for the whole route and checks the ledger.
3. **Two trips per driver per day.** Checked inside a serializable transaction when publishing
   (Kigali calendar day of departure, cancelled trips don't count). Recurring trips check every
   occurrence and create nothing if any day is full.

### Corridor matching

Trips are an ordered list of stops (`TripStop`: place, order, cumulative km) built from the
**places graph** (15 Kigali points + road links, Dijkstra). A trip matches a passenger when both
their stops are on its corridor **and board order < alight order** — so a CBD-bound trip never
matches someone going the other way. Seats are **segment-aware**: a seat freed at Kimisagara can
be resold further along. Ranking: departure-time proximity (15-min buckets) → fewest spare km →
driver rating. Women-only trips are filtered in the engine *and* refused with `403 WOMEN_ONLY` by
the API.

### Request → accept → pay

```
JoinRequest: pending ─accept→ accepted ─(MoMo confirmed)→ Booking(confirmed) ─trip completed→ completed
                 ├─decline→ declined          └─passenger cancels / trip leaves unpaid → cancelled / expired
                 └─passenger cancels → cancelled;  trip starts → expired
Payment:     initiated ─webhook→ confirmed | failed (seat stays held, retry)
```

Transitions are defined once in `packages/shared/src/stateMachine.ts`; the API rejects
anything else with `409 INVALID_TRANSITION`. Webhooks are idempotent.

### Architecture

```
┌──────────────────────┐   REST + Socket.IO   ┌──────────────────────────────┐
│ apps/mobile (Expo)   │ ───────────────────▶ │ apps/api (Fastify)           │
│  Expo Router screens │ ◀─── realtime ────── │  routes → services → Prisma  │──▶ SQLite (dev) / Postgres
│  TanStack Query      │                      │  providers/                  │
│  <TripMap> (native:  │                      │   PaymentProvider (MockMomo) │
│   react-native-maps, │                      │   SmsProvider (MockSms)      │
│   web: SVG)          │                      │   PushProvider (MockPush)    │
└──────────────────────┘                      └──────────────────────────────┘
┌──────────────────────┐                                    ▲
│ apps/admin (Vite)    │ ───────────── REST + Socket.IO ────┘
└──────────────────────┘
          all three import ▶ packages/shared (fare engine · matching engine · Zod API contract)
```

* API contract: [`docs/API.md`](docs/API.md) + `packages/shared/src/api.ts` (Zod schemas, validated
  on every request; responses are validated in dev/test).
* Build plan and decisions: [`PLAN.md`](PLAN.md).

## What's mocked vs real

| Area | Dev (now) | Production seam |
|---|---|---|
| OTP / SMS | `MockSmsProvider` — code is always `123456`, every SMS printed to the API log and saved to the admin **Outbox** | Implement `SmsProvider` (`apps/api/src/providers/sms.ts`) with an SMS gateway and pass it to `buildApp` |
| Payments | `MockMomoProvider` — "request to pay", a simulated USSD prompt 2 s later (in-app **Approve / Decline**), then our own webhook | Implement `PaymentProvider` (`initiateCharge`, `confirmCharge`, `payout`, `refund`, `parseWebhook`) for MTN MoMo / Airtel Money |
| Push notifications | In-app notification centre + Socket.IO events; `MockPushProvider` logs to Outbox | Implement `PushProvider` with Expo push tokens |
| Maps | react-native-maps with OpenStreetMap tiles (iOS/Android); SVG corridor schematic on web | Swap tiles/SDK inside `apps/mobile/src/components/TripMap/` only |
| Distances | Places graph: haversine × 1.3 road factor | Replace `shortestPath`/`buildCorridor` in `packages/shared/src/places.ts` (geo-radius matching is Phase 2) |
| File uploads | Base64 → `apps/api/uploads/` on disk | Object storage behind `POST /uploads` |
| Database | SQLite file `apps/api/prisma/dev.db` | Postgres: change `provider` in `schema.prisma`, set `DATABASE_URL`, regenerate migrations |
| Real | Pricing, matching, daily limit, women-only, suspension, state machines, ratings, SOS records, realtime | — |

Phase-2 seams left clean (none implemented): geo-radius matching, real MoMo/Airtel, push
notifications, Kinyarwanda i18n.
