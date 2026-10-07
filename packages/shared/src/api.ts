/**
 * The API contract: every request body/query and response shape, as Zod schemas.
 * The API parses with these; mobile and admin use the inferred types.
 * Dates travel as ISO-8601 strings.
 */
import { z } from 'zod';
import { MAX_SEATS, MIN_SEATS } from './constants';
import { BOOKING_STATUSES, JOIN_REQUEST_STATUSES, PAYMENT_STATUSES, TRIP_STATUSES } from './stateMachine';
import { WEEKDAYS } from './time';

// ─── enums ──────────────────────────────────────────────────────────────────────
export const GenderSchema = z.enum(['female', 'male', 'other']);
export const UserStatusSchema = z.enum(['active', 'suspended']);
export const WeekdaySchema = z.enum(WEEKDAYS);
export const TripStatusSchema = z.enum(TRIP_STATUSES);
export const JoinRequestStatusSchema = z.enum(JOIN_REQUEST_STATUSES);
export const BookingStatusSchema = z.enum(BOOKING_STATUSES);
export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const VerificationTypeSchema = z.enum(['email', 'id', 'licence', 'vehicle']);
export const VerificationStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export const ReportStatusSchema = z.enum(['open', 'reviewing', 'resolved']);
export const RATING_TAGS = ['Punctual', 'Safe driving', 'Clean car', 'Friendly', 'Late pickup'] as const;
export const RatingTagSchema = z.enum(RATING_TAGS);
export const REPORT_REASONS = ['unsafe_driving', 'harassment', 'no_show', 'vehicle_mismatch', 'asked_for_more_money', 'other'] as const;
export const ReportReasonSchema = z.enum(REPORT_REASONS);

export type Gender = z.infer<typeof GenderSchema>;
export type VerificationType = z.infer<typeof VerificationTypeSchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type RatingTag = z.infer<typeof RatingTagSchema>;
export type ReportReason = z.infer<typeof ReportReasonSchema>;

// ─── primitives ─────────────────────────────────────────────────────────────────
/** Rwandan mobile number, normalised to +2507XXXXXXXX. Accepts 07…, 2507…, +2507…, with spaces. */
export const PhoneSchema = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .transform((s) => (s.startsWith('+') ? s : s.startsWith('250') ? `+${s}` : s.startsWith('0') ? `+250${s.slice(1)}` : s))
  .pipe(z.string().regex(/^\+2507[2389]\d{7}$/, 'Enter a Rwandan mobile number, e.g. 078 123 4567'));
const IsoDate = z.string();
const Id = z.string().min(1);

export const ErrorSchema = z.object({ error: z.string(), message: z.string(), details: z.unknown().optional() });
export type ApiError = z.infer<typeof ErrorSchema>;
export const OkSchema = z.object({ ok: z.literal(true) });

// ─── users ──────────────────────────────────────────────────────────────────────
export const ChipStateSchema = z.enum(['none', 'pending', 'verified']);
export const VerificationChipsSchema = z.object({
  phone: ChipStateSchema,
  email: ChipStateSchema,
  id: ChipStateSchema,
  licence: ChipStateSchema,
  vehicle: ChipStateSchema,
});
export type VerificationChips = z.infer<typeof VerificationChipsSchema>;

export const PublicUserSchema = z.object({
  id: Id,
  name: z.string(),
  photoUrl: z.string().nullable(),
  ratingAvg: z.number(),
  ratingCount: z.number().int(),
  verification: VerificationChipsSchema,
  memberSince: IsoDate,
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const PlaceSchema = z.object({ id: Id, name: z.string(), lat: z.number(), lng: z.number(), landmark: z.string() });
export type Place = z.infer<typeof PlaceSchema>;

export const VehicleSchema = z.object({
  id: Id,
  make: z.string(),
  model: z.string(),
  plate: z.string(),
  color: z.string(),
  seats: z.number().int(),
  isEV: z.boolean(),
  photos: z.array(z.string()),
  verified: z.boolean(),
});
export type Vehicle = z.infer<typeof VehicleSchema>;

export const VerificationRequestSchema = z.object({
  id: Id,
  type: VerificationTypeSchema,
  status: VerificationStatusSchema,
  documentUrl: z.string().nullable(),
  email: z.string().nullable(),
  vehicleId: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: IsoDate,
  reviewedAt: IsoDate.nullable(),
});
export type VerificationRequest = z.infer<typeof VerificationRequestSchema>;

export const MeSchema = PublicUserSchema.extend({
  phone: z.string(),
  email: z.string().nullable(),
  gender: GenderSchema.nullable(),
  homeArea: z.string().nullable(),
  trustedContactPhone: z.string().nullable(),
  isAdmin: z.boolean(),
  status: UserStatusSchema,
  profileComplete: z.boolean(),
  vehicles: z.array(VehicleSchema),
  verificationRequests: z.array(VerificationRequestSchema),
});
export type Me = z.infer<typeof MeSchema>;

export const UpdateMeSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  email: z.email().nullable().optional(),
  gender: GenderSchema.nullable().optional(),
  homeArea: z.string().trim().max(60).nullable().optional(),
  trustedContactPhone: PhoneSchema.nullable().optional(),
  photoUrl: z.string().nullable().optional(),
});
export type UpdateMeInput = z.input<typeof UpdateMeSchema>;

// ─── auth ───────────────────────────────────────────────────────────────────────
export const OtpRequestSchema = z.object({ phone: PhoneSchema });
export const OtpRequestResponseSchema = z.object({ ok: z.literal(true), phone: z.string(), devHint: z.string().optional() });
export const OtpVerifySchema = z.object({ phone: PhoneSchema, code: z.string().regex(/^\d{6}$/, 'The code has 6 digits') });
export const AuthResponseSchema = z.object({ token: z.string(), user: MeSchema, isNew: z.boolean() });
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export const DevAccountSchema = z.object({ phone: z.string(), name: z.string(), role: z.string(), note: z.string() });
export type DevAccount = z.infer<typeof DevAccountSchema>;

// ─── vehicles & uploads ─────────────────────────────────────────────────────────
export const CreateVehicleSchema = z.object({
  make: z.string().trim().min(2).max(30),
  model: z.string().trim().min(1).max(30),
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^R[A-Z]{2} ?\d{3} ?[A-Z]$/, 'Rwandan plates look like RAD 123 A'),
  color: z.string().trim().min(2).max(20),
  seats: z.number().int().min(MIN_SEATS).max(8),
  isEV: z.boolean(),
  photos: z.array(z.string()).min(1, 'Add at least one photo').max(3),
});
export type CreateVehicleInput = z.input<typeof CreateVehicleSchema>;

export const UploadSchema = z.object({
  base64: z.string().min(10),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
});
export const UploadResponseSchema = z.object({ url: z.string() });

export const CreateVerificationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('email'), email: z.email() }),
  z.object({ type: z.literal('id'), documentUrl: z.string().min(1) }),
  z.object({ type: z.literal('licence'), documentUrl: z.string().min(1) }),
  z.object({ type: z.literal('vehicle'), vehicleId: Id, documentUrl: z.string().min(1) }),
]);
export type CreateVerificationInput = z.input<typeof CreateVerificationSchema>;

// ─── trips ──────────────────────────────────────────────────────────────────────
export const TripStopSchema = z.object({
  id: Id,
  placeId: Id,
  order: z.number().int(),
  cumulativeKm: z.number(),
  place: PlaceSchema,
});
export type TripStop = z.infer<typeof TripStopSchema>;

export const ContributionSchema = z.object({ costShare: z.number(), bookingFee: z.number(), total: z.number() });

export const LedgerSchema = z.object({
  tripCost: z.number(),
  recovered: z.number(),
  driverCarries: z.number(),
  maxRecovery: z.number(),
  runningCostPerKm: z.number(),
});
export type Ledger = z.infer<typeof LedgerSchema>;

export const TripSummarySchema = z.object({
  id: Id,
  seriesId: z.string().nullable(),
  departureTime: IsoDate,
  recurringDays: z.array(WeekdaySchema).nullable(),
  seatsOffered: z.number().int(),
  /** Free seats for the whole corridor (the tightest leg). */
  seatsLeft: z.number().int(),
  womenOnly: z.boolean(),
  isEV: z.boolean(),
  status: TripStatusSchema,
  totalKm: z.number(),
  stops: z.array(TripStopSchema),
  driver: PublicUserSchema,
  vehicle: VehicleSchema,
  fullRouteContribution: ContributionSchema,
});
export type TripSummary = z.infer<typeof TripSummarySchema>;

export const PublishTripSchema = z.object({
  vehicleId: Id,
  departureTime: IsoDate.refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid departure time'),
  recurringDays: z.array(WeekdaySchema).min(1).nullable().optional(),
  seatsOffered: z.number().int().min(MIN_SEATS).max(MAX_SEATS),
  womenOnly: z.boolean().default(false),
  /** Stops the driver will serve, in driving order: origin, chosen intermediate stops, destination. */
  stopPlaceIds: z.array(Id).min(2).max(12),
});
export type PublishTripInput = z.input<typeof PublishTripSchema>;

export const SearchTripsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  /** `today`, `tomorrow`, `week` or a Kigali date `YYYY-MM-DD`. */
  when: z.string().default('week'),
  /** Desired departure time `HH:mm` (Kigali) used for ranking. */
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  womenOnly: z.enum(['true', 'false']).optional(),
});
export type SearchTripsQuery = z.input<typeof SearchTripsQuerySchema>;

export const TripMatchSchema = z.object({
  trip: TripSummarySchema,
  boardStopId: Id,
  alightStopId: Id,
  segmentKm: z.number(),
  spareKm: z.number(),
  seatsAvailable: z.number().int(),
  contribution: ContributionSchema,
});
export type TripMatch = z.infer<typeof TripMatchSchema>;

export const PaymentSchema = z.object({
  id: Id,
  joinRequestId: Id,
  amount: z.number(),
  provider: z.string(),
  providerRef: z.string(),
  msisdn: z.string(),
  status: PaymentStatusSchema,
  failureReason: z.string().nullable(),
  createdAt: IsoDate,
});
export type Payment = z.infer<typeof PaymentSchema>;

export const JoinRequestSchema = z.object({
  id: Id,
  tripId: Id,
  passenger: PublicUserSchema,
  boardStop: TripStopSchema,
  alightStop: TripStopSchema,
  status: JoinRequestStatusSchema,
  segmentKm: z.number(),
  contributionAmount: z.number(),
  bookingFee: z.number(),
  total: z.number(),
  createdAt: IsoDate,
  respondedAt: IsoDate.nullable(),
  bookingId: z.string().nullable(),
  latestPayment: PaymentSchema.nullable(),
});
export type JoinRequest = z.infer<typeof JoinRequestSchema>;

export const TripDetailSchema = TripSummarySchema.extend({
  /** Passengers on each leg (leg i = stop i → stop i+1). */
  legOccupancy: z.array(z.number().int()),
  viewerRole: z.enum(['driver', 'passenger', 'viewer']),
  myJoinRequest: JoinRequestSchema.nullable(),
  /** Driver only. */
  joinRequests: z.array(JoinRequestSchema).nullable(),
  /** Driver only. */
  ledger: LedgerSchema.nullable(),
  /** Driver only: confirmed/completed bookings with passenger and board point. */
  passengers: z
    .array(
      z.object({
        bookingId: Id,
        status: BookingStatusSchema,
        tripCode: z.string(),
        passenger: PublicUserSchema,
        boardStop: TripStopSchema,
        alightStop: TripStopSchema,
        contributionAmount: z.number(),
        driverRated: z.boolean(),
      }),
    )
    .nullable(),
});
export type TripDetail = z.infer<typeof TripDetailSchema>;

export const JoinTripSchema = z.object({ boardStopId: Id, alightStopId: Id });
export type JoinTripInput = z.input<typeof JoinTripSchema>;

export const PayJoinRequestSchema = z.object({ msisdn: PhoneSchema.optional() });

export const DailyMeterSchema = z.object({ dayKey: z.string(), used: z.number().int(), limit: z.number().int() });
export type DailyMeter = z.infer<typeof DailyMeterSchema>;

export const DriverDashboardSchema = z.object({
  hasVehicle: z.boolean(),
  /** Today's meter (Kigali day). */
  dailyMeter: DailyMeterSchema,
  /** The trip the dashboard focuses on: in progress, else the next upcoming one. */
  focusTrip: TripDetailSchema.nullable(),
  upcomingTrips: z.array(TripSummarySchema),
  pendingRequestCount: z.number().int(),
  /** Pre-filled return trip for the focus trip (reverse corridor, same vehicle). */
  returnTripDraft: z
    .object({
      vehicleId: Id,
      stopPlaceIds: z.array(Id),
      seatsOffered: z.number().int(),
      womenOnly: z.boolean(),
      dayKey: z.string(),
      meterForDay: DailyMeterSchema,
    })
    .nullable(),
});
export type DriverDashboard = z.infer<typeof DriverDashboardSchema>;

// ─── bookings, ratings, chat, safety ────────────────────────────────────────────
export const RatingSchema = z.object({
  id: Id,
  bookingId: Id,
  raterId: Id,
  rateeId: Id,
  stars: z.number().int().min(1).max(5),
  tags: z.array(RatingTagSchema),
  comment: z.string().nullable(),
  createdAt: IsoDate,
});
export type Rating = z.infer<typeof RatingSchema>;

export const BookingSchema = z.object({
  id: Id,
  tripCode: z.string(),
  status: BookingStatusSchema,
  viewerRole: z.enum(['driver', 'passenger']),
  trip: TripSummarySchema,
  boardStop: TripStopSchema,
  alightStop: TripStopSchema,
  segmentKm: z.number(),
  contributionAmount: z.number(),
  bookingFee: z.number(),
  total: z.number(),
  passenger: PublicUserSchema,
  driver: PublicUserSchema,
  payment: PaymentSchema,
  myRating: RatingSchema.nullable(),
  /** Whether the other side has rated (the stars stay private until both rate). */
  counterpartRated: z.boolean(),
  trustedContactPhone: z.string().nullable(),
  createdAt: IsoDate,
});
export type Booking = z.infer<typeof BookingSchema>;

export const CreateRatingSchema = z.object({
  stars: z.number().int().min(1).max(5),
  tags: z.array(RatingTagSchema).max(5).default([]),
  comment: z.string().trim().max(500).nullable().optional(),
});
export type CreateRatingInput = z.input<typeof CreateRatingSchema>;

export const ChatMessageSchema = z.object({
  id: Id,
  bookingId: Id,
  senderId: Id,
  body: z.string(),
  createdAt: IsoDate,
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export const SendMessageSchema = z.object({ body: z.string().trim().min(1).max(1000) });

export const SosSchema = z.object({ lat: z.number().optional(), lng: z.number().optional() });
export const SosEventSchema = z.object({
  id: Id,
  bookingId: Id,
  userId: Id,
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  notifiedContacts: z.boolean(),
  contactPhone: z.string().nullable(),
  resolvedAt: IsoDate.nullable(),
  createdAt: IsoDate,
});
export type SosEvent = z.infer<typeof SosEventSchema>;

export const CreateReportSchema = z
  .object({
    reportedUserId: Id.optional(),
    bookingId: Id.optional(),
    reason: ReportReasonSchema,
    body: z.string().trim().min(5, 'Tell us a little more (5+ characters)').max(2000),
  })
  .refine((r) => r.reportedUserId || r.bookingId, 'Report a user or a booking');
export type CreateReportInput = z.input<typeof CreateReportSchema>;
export const ReportSchema = z.object({
  id: Id,
  reporterId: Id,
  reportedUserId: z.string().nullable(),
  bookingId: z.string().nullable(),
  reason: ReportReasonSchema,
  body: z.string(),
  status: ReportStatusSchema,
  createdAt: IsoDate,
});
export type Report = z.infer<typeof ReportSchema>;

export const BlockSchema = z.object({ userId: Id });
export const BlockedUserSchema = z.object({ user: PublicUserSchema, createdAt: IsoDate });

export const NotificationSchema = z.object({
  id: Id,
  type: z.string(),
  title: z.string(),
  body: z.string(),
  /** Deep-link target inside the app, e.g. `/booking/abc`. */
  href: z.string().nullable(),
  readAt: IsoDate.nullable(),
  createdAt: IsoDate,
});
export type Notification = z.infer<typeof NotificationSchema>;
export const MarkReadSchema = z.object({ ids: z.array(Id).optional() });

export const HistoryItemSchema = z.object({
  role: z.enum(['driver', 'passenger']),
  trip: TripSummarySchema,
  bookingId: z.string().nullable(),
  status: z.string(),
  amount: z.number(),
});
export type HistoryItem = z.infer<typeof HistoryItemSchema>;

export const PassengerRequestItemSchema = z.object({
  joinRequest: JoinRequestSchema,
  trip: TripSummarySchema,
});
export type PassengerRequestItem = z.infer<typeof PassengerRequestItemSchema>;

// ─── realtime events (server → client) ──────────────────────────────────────────
export const MomoPromptSchema = z.object({
  paymentId: Id,
  providerRef: z.string(),
  amount: z.number(),
  msisdn: z.string(),
  merchant: z.string(),
});
export type MomoPrompt = z.infer<typeof MomoPromptSchema>;

export interface ServerToClientEvents {
  notification: (n: Notification) => void;
  'join_request:updated': (jr: JoinRequest) => void;
  'trip:updated': (e: { tripId: string; status: string }) => void;
  'payment:updated': (p: Payment & { bookingId: string | null }) => void;
  'chat:message': (m: ChatMessage) => void;
  /** Dev only: the mock MoMo provider simulating the USSD push on the payer's phone. */
  'momo:prompt': (p: MomoPrompt) => void;
  /** Admins only: something in a queue changed — refetch. */
  'admin:changed': (e: { kind: 'sos' | 'report' | 'verification' | 'booking' | 'user' }) => void;
}

// ─── admin ──────────────────────────────────────────────────────────────────────
export const AdminStatsSchema = z.object({
  users: z.number().int(),
  drivers: z.number().int(),
  tripsToday: z.number().int(),
  tripsPublished: z.number().int(),
  joinRequests: z.number().int(),
  /** Share of join requests a driver accepted (0–1). */
  matchRate: z.number(),
  bookings: z.number().int(),
  feeRevenue: z.number(),
  costSharesPaid: z.number(),
  passengerKm: z.number(),
  co2SavedKg: z.number(),
  openReports: z.number().int(),
  openSos: z.number().int(),
  pendingVerifications: z.number().int(),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

export const AdminUserSchema = MeSchema.omit({ vehicles: true, verificationRequests: true }).extend({
  vehicleCount: z.number().int(),
  tripCount: z.number().int(),
  bookingCount: z.number().int(),
  createdAt: IsoDate,
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminVehicleSchema = VehicleSchema.extend({ owner: PublicUserSchema, createdAt: IsoDate });
export type AdminVehicle = z.infer<typeof AdminVehicleSchema>;

export const AdminBookingSchema = z.object({
  id: Id,
  tripCode: z.string(),
  status: BookingStatusSchema,
  tripId: Id,
  route: z.string(),
  departureTime: IsoDate,
  passenger: PublicUserSchema,
  driver: PublicUserSchema,
  segment: z.string(),
  segmentKm: z.number(),
  contributionAmount: z.number(),
  bookingFee: z.number(),
  paymentStatus: PaymentStatusSchema,
  createdAt: IsoDate,
});
export type AdminBooking = z.infer<typeof AdminBookingSchema>;

export const AdminPaymentSchema = PaymentSchema.extend({
  bookingId: z.string().nullable(),
  tripCode: z.string().nullable(),
  payer: PublicUserSchema,
});
export type AdminPayment = z.infer<typeof AdminPaymentSchema>;

export const AdminRatingSchema = RatingSchema.extend({ rater: PublicUserSchema, ratee: PublicUserSchema, tripCode: z.string() });
export type AdminRating = z.infer<typeof AdminRatingSchema>;

export const AdminVerificationSchema = VerificationRequestSchema.extend({
  user: PublicUserSchema,
  vehicle: VehicleSchema.nullable(),
});
export type AdminVerification = z.infer<typeof AdminVerificationSchema>;

export const AdminReportSchema = ReportSchema.extend({
  reporter: PublicUserSchema,
  reportedUser: PublicUserSchema.nullable(),
  tripCode: z.string().nullable(),
});
export type AdminReport = z.infer<typeof AdminReportSchema>;

export const AdminSosSchema = SosEventSchema.extend({
  user: PublicUserSchema,
  tripCode: z.string(),
  route: z.string(),
  driver: PublicUserSchema,
});
export type AdminSos = z.infer<typeof AdminSosSchema>;

export const OutboxMessageSchema = z.object({
  id: Id,
  channel: z.enum(['sms', 'push']),
  to: z.string(),
  body: z.string(),
  createdAt: IsoDate,
});
export type OutboxMessage = z.infer<typeof OutboxMessageSchema>;

export const AdminListQuerySchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
});
export const UpdateReportSchema = z.object({ status: ReportStatusSchema });
export const ReviewVerificationSchema = z.object({ note: z.string().max(300).optional() });

export const AdminTripSchema = TripSummarySchema.extend({
  bookingCount: z.number().int(),
  requestCount: z.number().int(),
  createdAt: IsoDate,
});
export type AdminTrip = z.infer<typeof AdminTripSchema>;
