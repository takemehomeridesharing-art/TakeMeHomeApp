/**
 * Typed TanStack Query hooks for every mobile endpoint in docs/API.md, plus the query-key
 * factory (`qk`) they share. Mutations invalidate the keys whose data they change; the
 * realtime bridge (`components/RealtimeBridge`) invalidates the same keys on socket events.
 *
 * Conventions:
 * - Query hooks take an optional `options` object (`enabled`, `refetchInterval`, …) that is
 *   spread into `useQuery`.
 * - Mutation hooks take their path params inside the `mutate` variables, e.g.
 *   `useAcceptRequest().mutate(requestId)`.
 */
import {
  AuthResponseSchema,
  BlockedUserSchema,
  BookingSchema,
  ChatMessageSchema,
  DailyMeterSchema,
  DevAccountSchema,
  DriverDashboardSchema,
  HistoryItemSchema,
  JoinRequestSchema,
  KIGALI_PLACES,
  MeSchema,
  NotificationSchema,
  OtpRequestResponseSchema,
  PassengerRequestItemSchema,
  PaymentSchema,
  PlaceSchema,
  PublicUserSchema,
  TripDetailSchema,
  TripMatchSchema,
  TripSummarySchema,
  VehicleSchema,
  VerificationRequestSchema,
  type AuthResponse,
  type Booking,
  type ChatMessage,
  type CreateRatingInput,
  type CreateReportInput,
  type CreateVehicleInput,
  type CreateVerificationInput,
  type DailyMeter,
  type DevAccount,
  type DriverDashboard,
  type HistoryItem,
  type JoinRequest,
  type Me,
  type Notification,
  type PassengerRequestItem,
  type Payment,
  type Place,
  type PublicUser,
  type PublishTripInput,
  type Rating,
  type Report,
  type SearchTripsQuery,
  type SosEvent,
  type TripDetail,
  type TripMatch,
  type TripSummary,
  type UpdateMeInput,
  type Vehicle,
  type VerificationRequest,
} from '@tmh/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { useSession } from '@/stores/session';
import { api } from './api';

// ─── types not exported by @tmh/shared ────────────────────────────────────────
export type BlockedUser = ReturnType<typeof BlockedUserSchema.parse>;
export type OtpRequestResponse = ReturnType<typeof OtpRequestResponseSchema.parse>;
/** `GET /payments/:id` and the `payment:updated` event: a payment plus its booking once confirmed. */
export type PaymentWithBooking = Payment & { bookingId: string | null };
export type Ok = { ok: true };
/** Map-pin time window for `GET /trips/map`. */
export type MapWhen = 'today' | 'tomorrow' | 'week' | (string & {});

const PaymentWithBookingSchema = PaymentSchema.extend({ bookingId: PaymentSchema.shape.id.nullable() });

// ─── query keys ───────────────────────────────────────────────────────────────
/** Query-key factory. Keys are hierarchical so `invalidateQueries({ queryKey: qk.trips.all })` hits every trip query. */
export const qk = {
  me: ['me'] as const,
  devAccounts: ['dev', 'accounts'] as const,
  user: (id: string) => ['users', id] as const,
  places: ['places'] as const,
  vehicles: ['vehicles'] as const,
  trips: {
    all: ['trips'] as const,
    search: (params: SearchTripsQuery) => ['trips', 'search', params] as const,
    map: (when: string) => ['trips', 'map', when] as const,
    detail: (id: string) => ['trips', 'detail', id] as const,
  },
  requests: {
    all: ['requests'] as const,
    mine: ['requests', 'mine'] as const,
    detail: (id: string) => ['requests', 'detail', id] as const,
  },
  payments: {
    all: ['payments'] as const,
    detail: (id: string) => ['payments', id] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    mine: ['bookings', 'mine'] as const,
    detail: (id: string) => ['bookings', 'detail', id] as const,
  },
  messages: (bookingId: string) => ['messages', bookingId] as const,
  blocks: ['blocks'] as const,
  notifications: ['notifications'] as const,
  history: ['history'] as const,
  driver: {
    all: ['driver'] as const,
    dashboard: ['driver', 'dashboard'] as const,
    meter: (day: string) => ['driver', 'meter', day] as const,
  },
};

/** Extra `useQuery` options a hook caller may pass. */
export type QueryOpts<T> = Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, 'queryKey' | 'queryFn'>;

function useSignedIn(): boolean {
  return useSession((s) => Boolean(s.token));
}

function invalidate(client: QueryClient, ...keys: (readonly unknown[])[]): void {
  for (const queryKey of keys) void client.invalidateQueries({ queryKey });
}

// ─── auth & profile ───────────────────────────────────────────────────────────
/** POST /auth/otp/request — sends the SMS code. Variables: the phone number. */
export function useRequestOtp() {
  return useMutation({
    mutationFn: (phone: string) => api.post<OtpRequestResponse>('/auth/otp/request', { phone }, { auth: false, schema: OtpRequestResponseSchema }),
  });
}

/** POST /auth/otp/verify — on success stores the session (token + user). */
export function useVerifyOtp() {
  return useMutation({
    mutationFn: (input: { phone: string; code: string }) =>
      api.post<AuthResponse>('/auth/otp/verify', input, { auth: false, schema: AuthResponseSchema }),
    onSuccess: (auth) => useSession.getState().signIn(auth),
  });
}

/** GET /dev/accounts — seeded accounts for the dev login helper (dev builds only). */
export function useDevAccounts(options?: QueryOpts<DevAccount[]>) {
  return useQuery({
    queryKey: qk.devAccounts,
    queryFn: () => api.get<DevAccount[]>('/dev/accounts', { auth: false, schema: DevAccountSchema.array() }),
    retry: false,
    staleTime: 5 * 60_000,
    ...options,
  });
}

/** GET /me — the signed-in user. Keeps the session store's `me` in sync. */
export function useMe(options?: QueryOpts<Me>) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      const me = await api.get<Me>('/me', { schema: MeSchema });
      useSession.getState().setMe(me);
      return me;
    },
    initialData: () => useSession.getState().me ?? undefined,
    initialDataUpdatedAt: 0,
    enabled: signedIn,
    ...options,
  });
}

/** PATCH /me — update name, gender, home area, trusted contact, photo, email. */
export function useUpdateMe() {
  return useMutation({
    mutationFn: (input: UpdateMeInput) => api.patch<Me>('/me', input, { schema: MeSchema }),
    onSuccess: (me) => useSession.getState().setMe(me),
  });
}

/** GET /users/:id — a public profile. */
export function useUser(id: string | undefined, options?: QueryOpts<PublicUser>) {
  return useQuery({
    queryKey: qk.user(id ?? ''),
    queryFn: () => api.get<PublicUser>(`/users/${id}`, { schema: PublicUserSchema }),
    enabled: Boolean(id),
    ...options,
  });
}

/** POST /uploads — upload a base64 image/PDF; resolves to `{ url }` (a path — render with `assetUrl`). */
export function useUpload() {
  return useMutation({
    mutationFn: (input: { base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' }) =>
      api.post<{ url: string }>('/uploads', input),
  });
}

/** POST /verifications — submit email / ID / licence / vehicle verification. */
export function useCreateVerification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVerificationInput) => api.post<VerificationRequest>('/verifications', input, { schema: VerificationRequestSchema }),
    onSuccess: () => {
      invalidate(client, qk.vehicles, qk.driver.all);
      void useSession.getState().refreshMe();
    },
  });
}

// ─── places & vehicles ────────────────────────────────────────────────────────
/** GET /places — named Kigali stops. Shows the bundled list while loading/offline. */
export function usePlaces(options?: QueryOpts<Place[]>) {
  return useQuery({
    queryKey: qk.places,
    queryFn: () => api.get<Place[]>('/places', { schema: PlaceSchema.array() }),
    placeholderData: KIGALI_PLACES as Place[],
    staleTime: Infinity,
    ...options,
  });
}

/** GET /vehicles — my vehicles. */
export function useVehicles(options?: QueryOpts<Vehicle[]>) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: qk.vehicles,
    queryFn: () => api.get<Vehicle[]>('/vehicles', { schema: VehicleSchema.array() }),
    enabled: signedIn,
    ...options,
  });
}

/** POST /vehicles — register a vehicle. */
export function useCreateVehicle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVehicleInput) => api.post<Vehicle>('/vehicles', input, { schema: VehicleSchema }),
    onSuccess: () => {
      invalidate(client, qk.vehicles, qk.driver.all);
      void useSession.getState().refreshMe();
    },
  });
}

// ─── trips (driver) ───────────────────────────────────────────────────────────
/** POST /trips — publish a trip (returns one summary per dated occurrence). */
export function usePublishTrip() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PublishTripInput) => api.post<TripSummary[]>('/trips', input, { schema: TripSummarySchema.array() }),
    onSuccess: () => invalidate(client, qk.driver.all, qk.trips.all, qk.history),
  });
}

/** GET /driver/dashboard — focus trip, meter, upcoming trips, return-trip draft. */
export function useDriverDashboard(options?: QueryOpts<DriverDashboard>) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: qk.driver.dashboard,
    queryFn: () => api.get<DriverDashboard>('/driver/dashboard', { schema: DriverDashboardSchema }),
    enabled: signedIn,
    ...options,
  });
}

/** GET /driver/meter?day=YYYY-MM-DD — trips used vs the daily limit for a Kigali day. */
export function useDriverMeter(day: string | undefined, options?: QueryOpts<DailyMeter>) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: qk.driver.meter(day ?? ''),
    queryFn: () => api.get<DailyMeter>('/driver/meter', { query: { day }, schema: DailyMeterSchema }),
    enabled: signedIn && Boolean(day),
    ...options,
  });
}

function useTripTransition(action: 'start' | 'complete' | 'cancel') {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => api.post<TripDetail>(`/trips/${tripId}/${action}`, undefined, { schema: TripDetailSchema }),
    onSuccess: (trip) => {
      client.setQueryData(qk.trips.detail(trip.id), trip);
      invalidate(client, qk.trips.all, qk.driver.all, qk.bookings.all, qk.requests.all, qk.history);
    },
  });
}

/** POST /trips/:id/start. Variables: tripId. */
export const useStartTrip = () => useTripTransition('start');
/** POST /trips/:id/complete. Variables: tripId. */
export const useCompleteTrip = () => useTripTransition('complete');
/** POST /trips/:id/cancel. Variables: tripId. */
export const useCancelTrip = () => useTripTransition('cancel');

function useRequestDecision(action: 'accept' | 'decline') {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => api.post<JoinRequest>(`/join-requests/${requestId}/${action}`, undefined, { schema: JoinRequestSchema }),
    onSuccess: (jr) => invalidate(client, qk.trips.detail(jr.tripId), qk.driver.all, qk.requests.all),
  });
}

/** POST /join-requests/:id/accept (driver). Variables: requestId. */
export const useAcceptRequest = () => useRequestDecision('accept');
/** POST /join-requests/:id/decline (driver). Variables: requestId. */
export const useDeclineRequest = () => useRequestDecision('decline');

/** POST /bookings/:id/no-show (driver). Variables: bookingId. */
export function useNoShow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => api.post<Booking>(`/bookings/${bookingId}/no-show`, undefined, { schema: BookingSchema }),
    onSuccess: (booking) => {
      client.setQueryData(qk.bookings.detail(booking.id), booking);
      invalidate(client, qk.trips.detail(booking.trip.id), qk.driver.all, qk.bookings.mine);
    },
  });
}

// ─── trips (passenger) ────────────────────────────────────────────────────────
/** GET /trips/search — trips whose corridor covers from → to (in direction). */
export function useSearchTrips(params: SearchTripsQuery, options?: QueryOpts<TripMatch[]>) {
  return useQuery({
    queryKey: qk.trips.search(params),
    queryFn: () =>
      api.get<TripMatch[]>('/trips/search', {
        query: { from: params.from, to: params.to, when: params.when, time: params.time, womenOnly: params.womenOnly },
        schema: TripMatchSchema.array(),
      }),
    ...options,
  });
}

/** GET /trips/map?when= — published trips for map pins. */
export function useMapTrips(when: MapWhen = 'tomorrow', options?: QueryOpts<TripSummary[]>) {
  return useQuery({
    queryKey: qk.trips.map(when),
    queryFn: () => api.get<TripSummary[]>('/trips/map', { query: { when }, schema: TripSummarySchema.array() }),
    ...options,
  });
}

/** GET /trips/:id — trip detail (driver sees requests, ledger, passengers). */
export function useTrip(id: string | undefined, options?: QueryOpts<TripDetail>) {
  return useQuery({
    queryKey: qk.trips.detail(id ?? ''),
    queryFn: () => api.get<TripDetail>(`/trips/${id}`, { schema: TripDetailSchema }),
    enabled: Boolean(id),
    ...options,
  });
}

/** POST /trips/:id/join-requests — request to join. */
export function useJoinTrip() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, boardStopId, alightStopId }: { tripId: string; boardStopId: string; alightStopId: string }) =>
      api.post<JoinRequest>(`/trips/${tripId}/join-requests`, { boardStopId, alightStopId }, { schema: JoinRequestSchema }),
    onSuccess: (jr) => invalidate(client, qk.requests.all, qk.trips.detail(jr.tripId)),
  });
}

/** GET /join-requests/mine — my requests with their trips. */
export function useMyRequests(options?: QueryOpts<PassengerRequestItem[]>) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: qk.requests.mine,
    queryFn: () => api.get<PassengerRequestItem[]>('/join-requests/mine', { schema: PassengerRequestItemSchema.array() }),
    enabled: signedIn,
    ...options,
  });
}

/** GET /join-requests/:id — one of my requests with its trip. */
export function useJoinRequest(id: string | undefined, options?: QueryOpts<PassengerRequestItem>) {
  return useQuery({
    queryKey: qk.requests.detail(id ?? ''),
    queryFn: () => api.get<PassengerRequestItem>(`/join-requests/${id}`, { schema: PassengerRequestItemSchema }),
    enabled: Boolean(id),
    ...options,
  });
}

/** POST /join-requests/:id/cancel (passenger). Variables: requestId. */
export function useCancelRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => api.post<JoinRequest>(`/join-requests/${requestId}/cancel`, undefined, { schema: JoinRequestSchema }),
    onSuccess: (jr) => invalidate(client, qk.requests.all, qk.trips.detail(jr.tripId)),
  });
}

/** POST /join-requests/:id/pay — start a MoMo payment (status `initiated`). */
export function usePayRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, msisdn }: { requestId: string; msisdn?: string }) =>
      api.post<Payment>(`/join-requests/${requestId}/pay`, msisdn ? { msisdn } : {}, { schema: PaymentSchema }),
    onSuccess: (payment) => {
      client.setQueryData<PaymentWithBooking>(qk.payments.detail(payment.id), { ...payment, bookingId: null });
      invalidate(client, qk.requests.all);
    },
  });
}

/** GET /payments/:id — polls every 2 s while the payment is still `initiated` (socket events also refresh it). */
export function usePayment(id: string | undefined, options?: QueryOpts<PaymentWithBooking>) {
  return useQuery({
    queryKey: qk.payments.detail(id ?? ''),
    queryFn: () => api.get<PaymentWithBooking>(`/payments/${id}`, { schema: PaymentWithBookingSchema }),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.status === 'initiated' ? 2000 : false),
    ...options,
  });
}

// ─── bookings, chat, ratings, safety ──────────────────────────────────────────
/** GET /bookings/mine — bookings as passenger and as driver. */
export function useMyBookings(options?: QueryOpts<Booking[]>) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: qk.bookings.mine,
    queryFn: () => api.get<Booking[]>('/bookings/mine', { schema: BookingSchema.array() }),
    enabled: signedIn,
    ...options,
  });
}

/** GET /bookings/:id — the ticket. */
export function useBooking(id: string | undefined, options?: QueryOpts<Booking>) {
  return useQuery({
    queryKey: qk.bookings.detail(id ?? ''),
    queryFn: () => api.get<Booking>(`/bookings/${id}`, { schema: BookingSchema }),
    enabled: Boolean(id),
    ...options,
  });
}

/** GET /bookings/:id/messages — chat thread (kept fresh by `chat:message` events). */
export function useMessages(bookingId: string | undefined, options?: QueryOpts<ChatMessage[]>) {
  return useQuery({
    queryKey: qk.messages(bookingId ?? ''),
    queryFn: () => api.get<ChatMessage[]>(`/bookings/${bookingId}/messages`, { schema: ChatMessageSchema.array() }),
    enabled: Boolean(bookingId),
    ...options,
  });
}

/** Appends a message to a cached thread if it isn't there yet (used by send + socket). */
export function appendMessage(client: QueryClient, message: ChatMessage): void {
  client.setQueryData<ChatMessage[]>(qk.messages(message.bookingId), (prev) =>
    prev ? (prev.some((m) => m.id === message.id) ? prev : [...prev, message]) : prev,
  );
}

/** POST /bookings/:id/messages. */
export function useSendMessage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, body }: { bookingId: string; body: string }) =>
      api.post<ChatMessage>(`/bookings/${bookingId}/messages`, { body }, { schema: ChatMessageSchema }),
    onSuccess: (message) => appendMessage(client, message),
  });
}

/** POST /bookings/:id/ratings. */
export function useRateBooking() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, ...input }: CreateRatingInput & { bookingId: string }) =>
      api.post<Rating>(`/bookings/${bookingId}/ratings`, input),
    onSuccess: (rating) => invalidate(client, qk.bookings.detail(rating.bookingId), qk.bookings.mine, qk.history, qk.trips.all, qk.me),
  });
}

/** POST /bookings/:id/sos — alerts the trusted contact and the safety team. */
export function useSos() {
  return useMutation({
    mutationFn: ({ bookingId, lat, lng }: { bookingId: string; lat?: number; lng?: number }) =>
      api.post<SosEvent>(`/bookings/${bookingId}/sos`, { lat, lng }),
  });
}

/** POST /reports. */
export function useCreateReport() {
  return useMutation({
    mutationFn: (input: CreateReportInput) => api.post<Report>('/reports', input),
  });
}

/** GET /blocks — users I've blocked. */
export function useBlocks(options?: QueryOpts<BlockedUser[]>) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: qk.blocks,
    queryFn: () => api.get<BlockedUser[]>('/blocks', { schema: BlockedUserSchema.array() }),
    enabled: signedIn,
    ...options,
  });
}

/** POST /blocks. Variables: userId. */
export function useBlockUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.post<Ok>('/blocks', { userId }),
    onSuccess: () => invalidate(client, qk.blocks, qk.trips.all),
  });
}

/** DELETE /blocks/:userId. Variables: userId. */
export function useUnblockUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete<Ok>(`/blocks/${userId}`),
    onSuccess: () => invalidate(client, qk.blocks, qk.trips.all),
  });
}

/** GET /notifications — newest first. */
export function useNotifications(options?: QueryOpts<Notification[]>) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: qk.notifications,
    queryFn: () => api.get<Notification[]>('/notifications', { schema: NotificationSchema.array() }),
    enabled: signedIn,
    ...options,
  });
}

/** Number of unread notifications (for bell badges). */
export function useUnreadCount(): number {
  const { data } = useNotifications();
  return data?.filter((n) => !n.readAt).length ?? 0;
}

/** POST /notifications/read — marks `ids` (or all when omitted) as read. */
export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api.post<Ok>('/notifications/read', ids ? { ids } : {}),
    onMutate: (ids) => {
      const now = new Date().toISOString();
      client.setQueryData<Notification[]>(qk.notifications, (prev) =>
        prev?.map((n) => (!n.readAt && (!ids || ids.includes(n.id)) ? { ...n, readAt: now } : n)),
      );
    },
    onSettled: () => invalidate(client, qk.notifications),
  });
}

/** GET /history — past trips as driver and passenger. */
export function useHistory(options?: QueryOpts<HistoryItem[]>) {
  const signedIn = useSignedIn();
  return useQuery({
    queryKey: qk.history,
    queryFn: () => api.get<HistoryItem[]>('/history', { schema: HistoryItemSchema.array() }),
    enabled: signedIn,
    ...options,
  });
}
