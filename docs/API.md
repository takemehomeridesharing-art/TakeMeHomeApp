# Take Me Home API (v1)

Base URL in dev: `http://<host>:4000`. All bodies are JSON. Every request/response shape is a Zod
schema in `packages/shared/src/api.ts` (named in the table). Dates are ISO-8601 strings.

Auth: `Authorization: Bearer <jwt>` (from `/auth/otp/verify`). Errors are
`{ error: CODE, message: human readable, details? }` with the HTTP status below.

| Status | `error` codes |
|---|---|
| 400 | `VALIDATION_ERROR` (details = zod issues), `BAD_REQUEST` |
| 401 | `UNAUTHORIZED`, `INVALID_OTP` |
| 403 | `ACCOUNT_SUSPENDED` (any write by a suspended user), `WOMEN_ONLY`, `FORBIDDEN`, `BLOCKED` |
| 404 | `NOT_FOUND` |
| 409 | `INVALID_TRANSITION`, `DAILY_TRIP_LIMIT`, `NO_SEATS`, `ALREADY_REQUESTED`, `ALREADY_RATED`, `TOO_EARLY` (starting a trip before `startableFrom`), `CONFLICT` |

## Auth & profile

| Method | Path | Body / query | Response |
|---|---|---|---|
| POST | `/auth/otp/request` | `OtpRequestSchema` | `OtpRequestResponseSchema` |
| POST | `/auth/otp/verify` | `OtpVerifySchema` | `AuthResponseSchema` |
| GET | `/dev/accounts` | — (dev only, no auth) | `DevAccount[]` |
| GET | `/me` | — | `Me` |
| PATCH | `/me` | `UpdateMeSchema` | `Me` |
| GET | `/users/:id` | — | `PublicUser` |
| POST | `/uploads` | `UploadSchema` (`{ base64, mimeType }`) | `{ url }` — a path like `/uploads/abc.jpg`; resolve it against the API base URL. All stored photo/document URLs (`photoUrl`, vehicle `photos`, `documentUrl`) use this form. |
| POST | `/verifications` | `CreateVerificationSchema` | `VerificationRequest` |

## Places & vehicles

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/places` | — | `Place[]` (no auth needed) |
| GET | `/vehicles` | — | `Vehicle[]` (mine) |
| POST | `/vehicles` | `CreateVehicleSchema` | `Vehicle` |

## Trips (driver)

| Method | Path | Body / query | Response |
|---|---|---|---|
| POST | `/trips` | `PublishTripSchema` | `TripSummary[]` (one per dated occurrence) |
| GET | `/driver/dashboard` | — | `DriverDashboard` |
| GET | `/driver/meter?day=YYYY-MM-DD` | — | `DailyMeter` |
| POST | `/trips/:id/start` | — | `TripDetail` |
| POST | `/trips/:id/complete` | — | `TripDetail` |
| POST | `/trips/:id/cancel` | — | `TripDetail` |
| POST | `/join-requests/:id/accept` | — | `JoinRequest` |
| POST | `/join-requests/:id/decline` | — | `JoinRequest` |
| POST | `/bookings/:id/no-show` | — | `Booking` |

## Trips (passenger)

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/trips/search` | `SearchTripsQuerySchema` (`from,to,when,time,womenOnly`) | `TripMatch[]` |
| GET | `/trips/map?when=tomorrow` | — | `TripSummary[]` (published trips for the map pins) |
| GET | `/trips/:id` | — | `TripDetail` |
| POST | `/trips/:id/join-requests` | `JoinTripSchema` | `JoinRequest` |
| GET | `/join-requests/mine` | — | `PassengerRequestItem[]` |
| GET | `/join-requests/:id` | — | `PassengerRequestItem` |
| POST | `/join-requests/:id/cancel` | — | `JoinRequest` |
| POST | `/join-requests/:id/pay` | `PayJoinRequestSchema` | `Payment` (status `initiated`) |
| GET | `/payments/:id` | — | `Payment & { bookingId }` |

## Bookings, chat, ratings, safety

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/bookings/mine` | — | `Booking[]` (as passenger and as driver) |
| GET | `/bookings/:id` | — | `Booking` |
| GET | `/bookings/:id/messages` | — | `ChatMessage[]` |
| POST | `/bookings/:id/messages` | `SendMessageSchema` | `ChatMessage` |
| POST | `/bookings/:id/ratings` | `CreateRatingSchema` | `Rating` |
| POST | `/bookings/:id/sos` | `SosSchema` | `SosEvent` |
| POST | `/reports` | `CreateReportSchema` | `Report` |
| GET | `/blocks` | — | `{ user: PublicUser, createdAt }[]` |
| POST | `/blocks` | `BlockSchema` | `{ ok: true }` |
| DELETE | `/blocks/:userId` | — | `{ ok: true }` |
| GET | `/notifications` | — | `Notification[]` (newest first) |
| POST | `/notifications/read` | `MarkReadSchema` (no ids = all) | `{ ok: true }` |
| GET | `/history` | — | `HistoryItem[]` |

## Payments (provider side)

| Method | Path | Notes |
|---|---|---|
| POST | `/payments/webhook/:provider` | Provider callback. The mock provider calls its own webhook. |
| POST | `/dev/momo/:providerRef/respond` | Dev only: `{ approve: boolean }` — the mock "phone" answering the USSD prompt. |

## Admin (requires `isAdmin`)

| Method | Path | Query / body | Response |
|---|---|---|---|
| GET | `/admin/stats` | — | `AdminStats` |
| GET | `/admin/users` | `q`, `status` | `AdminUser[]` |
| POST | `/admin/users/:id/suspend` | — | `AdminUser` |
| POST | `/admin/users/:id/unsuspend` | — | `AdminUser` |
| GET | `/admin/vehicles` | `q` | `AdminVehicle[]` |
| GET | `/admin/trips` | `q`, `status` | `AdminTrip[]` |
| GET | `/admin/bookings` | `q`, `status` | `AdminBooking[]` |
| GET | `/admin/payments` | `q`, `status` | `AdminPayment[]` |
| GET | `/admin/ratings` | `q` | `AdminRating[]` |
| GET | `/admin/verifications` | `status` (default `pending`) | `AdminVerification[]` |
| POST | `/admin/verifications/:id/approve` | `ReviewVerificationSchema` | `AdminVerification` |
| POST | `/admin/verifications/:id/reject` | `ReviewVerificationSchema` | `AdminVerification` |
| GET | `/admin/reports` | `status` | `AdminReport[]` |
| PATCH | `/admin/reports/:id` | `UpdateReportSchema` | `AdminReport` |
| GET | `/admin/sos` | `status` = `open` / `resolved` | `AdminSos[]` |
| POST | `/admin/sos/:id/resolve` | — | `AdminSos` |
| GET | `/admin/outbox` | — | `OutboxMessage[]` (mock SMS + push log, newest first) |

## Realtime (Socket.IO, same origin as the API)

Connect with `io(API_URL, { auth: { token } })`. The server joins each socket to the room
`user:<id>` (and `admins` for admins). Events are typed in `ServerToClientEvents`:

| Event | Payload | Sent to |
|---|---|---|
| `notification` | `Notification` | the recipient |
| `join_request:updated` | `JoinRequest` | passenger + driver |
| `trip:updated` | `{ tripId, status }` | driver + every passenger with a request on the trip |
| `payment:updated` | `Payment & { bookingId }` | payer |
| `chat:message` | `ChatMessage` | both sides of the booking |
| `momo:prompt` | `MomoPrompt` | payer (dev only: the mock USSD push, ~2 s after `/pay`) |
| `admin:changed` | `{ kind: 'sos' \| 'report' \| 'verification' \| 'booking' \| 'user' }` | `admins` |
