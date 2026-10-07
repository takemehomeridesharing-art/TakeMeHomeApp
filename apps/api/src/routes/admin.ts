import {
  AdminBookingSchema,
  AdminListQuerySchema,
  AdminPaymentSchema,
  AdminRatingSchema,
  AdminReportSchema,
  AdminSosSchema,
  AdminStatsSchema,
  AdminTripSchema,
  AdminUserSchema,
  AdminVehicleSchema,
  AdminVerificationSchema,
  CO2_KG_PER_PASSENGER_KM,
  OutboxMessageSchema,
  ReviewVerificationSchema,
  UpdateReportSchema,
  kigaliDayBounds,
  round1,
  type ReportReason,
} from '@tmh/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../auth';
import { prisma } from '../db';
import { conflict, notFound, out, parse } from '../errors';
import { realtime } from '../realtime';
import { toSos } from '../services/bookings';
import { notify } from '../services/notify';
import {
  meInclude,
  toMe,
  toPayment,
  toPublicUser,
  toRating,
  toTripSummary,
  toVehicle,
  toVerificationRequest,
  tripInclude,
  userInclude,
} from '../services/serialize';

const IdParam = z.object({ id: z.string() });
const LIMIT = 500;

/** Case-insensitive text search over a few fields (done in JS so it behaves the same on SQLite and Postgres). */
function matches(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q?.trim()) return true;
  const needle = q.trim().toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

const routeOf = (stops: { place: { name: string } }[]) => `${stops[0]?.place.name ?? '?'} → ${stops[stops.length - 1]?.place.name ?? '?'}`;

async function adminUser(id: string) {
  const u = await prisma.user.findUnique({
    where: { id },
    include: { ...meInclude, _count: { select: { vehicles: true, trips: true, joinRequests: { where: { booking: { isNot: null } } } } } },
  });
  if (!u) throw notFound('That user');
  const { vehicles: _v, verificationRequests: _r, ...me } = toMe(u);
  return {
    ...me,
    vehicleCount: u._count.vehicles,
    tripCount: u._count.trips,
    bookingCount: u._count.joinRequests,
    createdAt: u.createdAt.toISOString(),
  };
}

const verificationInclude = { user: { include: userInclude }, vehicle: true } as const;

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/stats', async (request) => {
    await requireAdmin(request);
    const { start, end } = kigaliDayBounds(new Date());
    const paidStatuses = ['confirmed', 'completed', 'no_show'] as const;
    const [users, drivers, tripsToday, tripsPublished, joinRequests, decided, accepted, bookings, paid, completed, openReports, openSos, pendingVerifications] =
      await Promise.all([
        prisma.user.count({ where: { isAdmin: false } }),
        prisma.user.count({ where: { isAdmin: false, vehicles: { some: {} } } }),
        prisma.trip.count({ where: { departureTime: { gte: start, lt: end }, status: { not: 'cancelled' } } }),
        prisma.trip.count({ where: { status: { in: ['published', 'full'] } } }),
        prisma.joinRequest.count(),
        prisma.joinRequest.count({ where: { respondedAt: { not: null }, status: { in: ['accepted', 'declined'] } } }),
        prisma.joinRequest.count({ where: { status: 'accepted' } }),
        prisma.booking.count(),
        prisma.joinRequest.aggregate({
          where: { booking: { status: { in: [...paidStatuses] } } },
          _sum: { bookingFee: true, contributionAmount: true },
        }),
        prisma.joinRequest.aggregate({ where: { booking: { status: 'completed' } }, _sum: { segmentKm: true } }),
        prisma.report.count({ where: { status: { not: 'resolved' } } }),
        prisma.sosEvent.count({ where: { resolvedAt: null } }),
        prisma.verificationRequest.count({ where: { status: 'pending' } }),
      ]);
    const passengerKm = round1(completed._sum.segmentKm ?? 0);
    return out(AdminStatsSchema, {
      users,
      drivers,
      tripsToday,
      tripsPublished,
      joinRequests,
      matchRate: decided ? accepted / decided : 0,
      bookings,
      feeRevenue: paid._sum.bookingFee ?? 0,
      costSharesPaid: paid._sum.contributionAmount ?? 0,
      passengerKm,
      co2SavedKg: round1(passengerKm * CO2_KG_PER_PASSENGER_KM),
      openReports,
      openSos,
      pendingVerifications,
    });
  });

  // ── users ──
  app.get('/admin/users', async (request) => {
    await requireAdmin(request);
    const { q, status } = parse(AdminListQuerySchema, request.query);
    const rows = await prisma.user.findMany({
      where: status === 'active' || status === 'suspended' ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: { id: true, name: true, phone: true, email: true, homeArea: true },
    });
    const ids = rows.filter((u) => matches(q, u.name, u.phone, u.email, u.homeArea)).map((u) => u.id);
    return out(z.array(AdminUserSchema), await Promise.all(ids.map(adminUser)));
  });

  for (const [action, status] of [
    ['suspend', 'suspended'],
    ['unsuspend', 'active'],
  ] as const) {
    app.post(`/admin/users/:id/${action}`, async (request) => {
      const admin = await requireAdmin(request);
      const { id } = IdParam.parse(request.params);
      if (id === admin.id) throw conflict('You can’t suspend yourself.');
      await prisma.user.update({ where: { id }, data: { status } });
      await notify(id, `account_${status}`, {
        title: status === 'suspended' ? 'Your account is suspended' : 'Your account is active again',
        body:
          status === 'suspended'
            ? 'You can’t request, publish or pay while suspended. Contact support@takemehome.rw.'
            : 'Welcome back — you can request and publish trips again.',
      });
      realtime.toAdmins('admin:changed', { kind: 'user' });
      return out(AdminUserSchema, await adminUser(id));
    });
  }

  // ── vehicles / trips / bookings / payments / ratings ──
  app.get('/admin/vehicles', async (request) => {
    await requireAdmin(request);
    const { q } = parse(AdminListQuerySchema, request.query);
    const rows = await prisma.vehicle.findMany({ include: { owner: { include: userInclude } }, orderBy: { createdAt: 'desc' }, take: LIMIT });
    return out(
      z.array(AdminVehicleSchema),
      rows
        .filter((v) => matches(q, v.make, v.model, v.plate, v.color, v.owner.name, v.owner.phone))
        .map((v) => ({ ...toVehicle(v), owner: toPublicUser(v.owner), createdAt: v.createdAt.toISOString() })),
    );
  });

  app.get('/admin/trips', async (request) => {
    await requireAdmin(request);
    const { q, status } = parse(AdminListQuerySchema, request.query);
    const rows = await prisma.trip.findMany({
      where: status ? { status: status as never } : {},
      include: { ...tripInclude, _count: { select: { joinRequests: true } } },
      orderBy: { departureTime: 'desc' },
      take: LIMIT,
    });
    const bookingCounts = await prisma.joinRequest.groupBy({
      by: ['tripId'],
      where: { tripId: { in: rows.map((t) => t.id) }, booking: { isNot: null } },
      _count: { _all: true },
    });
    const bookingsByTrip = new Map(bookingCounts.map((b) => [b.tripId, b._count._all]));
    return out(
      z.array(AdminTripSchema),
      rows
        .filter((t) => matches(q, t.driver.name, t.vehicle.plate, ...t.stops.map((s) => s.place.name)))
        .map((t) => ({
          ...toTripSummary(t),
          bookingCount: bookingsByTrip.get(t.id) ?? 0,
          requestCount: t._count.joinRequests,
          createdAt: t.createdAt.toISOString(),
        })),
    );
  });

  app.get('/admin/bookings', async (request) => {
    await requireAdmin(request);
    const { q, status } = parse(AdminListQuerySchema, request.query);
    const rows = await prisma.booking.findMany({
      where: status ? { status: status as never } : {},
      include: {
        payment: true,
        joinRequest: {
          include: {
            passenger: { include: userInclude },
            boardStop: { include: { place: true } },
            alightStop: { include: { place: true } },
            trip: { include: { driver: { include: userInclude }, stops: { include: { place: true }, orderBy: { order: 'asc' } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    });
    return out(
      z.array(AdminBookingSchema),
      rows
        .filter((b) => matches(q, b.tripCode, b.joinRequest.passenger.name, b.joinRequest.trip.driver.name, b.joinRequest.passenger.phone))
        .map((b) => ({
          id: b.id,
          tripCode: b.tripCode,
          status: b.status,
          tripId: b.joinRequest.tripId,
          route: routeOf(b.joinRequest.trip.stops),
          departureTime: b.joinRequest.trip.departureTime.toISOString(),
          passenger: toPublicUser(b.joinRequest.passenger),
          driver: toPublicUser(b.joinRequest.trip.driver),
          segment: `${b.joinRequest.boardStop.place.name} → ${b.joinRequest.alightStop.place.name}`,
          segmentKm: b.joinRequest.segmentKm,
          contributionAmount: b.joinRequest.contributionAmount,
          bookingFee: b.joinRequest.bookingFee,
          paymentStatus: b.payment.status,
          createdAt: b.createdAt.toISOString(),
        })),
    );
  });

  app.get('/admin/payments', async (request) => {
    await requireAdmin(request);
    const { q, status } = parse(AdminListQuerySchema, request.query);
    const rows = await prisma.payment.findMany({
      where: status ? { status: status as never } : {},
      include: { booking: true, joinRequest: { include: { passenger: { include: userInclude } } } },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    });
    return out(
      z.array(AdminPaymentSchema),
      rows
        .filter((p) => matches(q, p.providerRef, p.msisdn, p.booking?.tripCode, p.joinRequest.passenger.name))
        .map((p) => ({
          ...toPayment(p),
          bookingId: p.booking?.id ?? null,
          tripCode: p.booking?.tripCode ?? null,
          payer: toPublicUser(p.joinRequest.passenger),
        })),
    );
  });

  app.get('/admin/ratings', async (request) => {
    await requireAdmin(request);
    const { q } = parse(AdminListQuerySchema, request.query);
    const rows = await prisma.rating.findMany({
      include: { rater: { include: userInclude }, ratee: { include: userInclude }, booking: { select: { tripCode: true } } },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    });
    return out(
      z.array(AdminRatingSchema),
      rows
        .filter((r) => matches(q, r.rater.name, r.ratee.name, r.booking.tripCode, r.comment))
        .map((r) => ({ ...toRating(r), rater: toPublicUser(r.rater), ratee: toPublicUser(r.ratee), tripCode: r.booking.tripCode })),
    );
  });

  // ── verification queue ──
  app.get('/admin/verifications', async (request) => {
    await requireAdmin(request);
    const { status } = parse(AdminListQuerySchema, request.query);
    const rows = await prisma.verificationRequest.findMany({
      where: { status: (status ?? 'pending') as never },
      include: verificationInclude,
      orderBy: { createdAt: 'asc' },
      take: LIMIT,
    });
    return out(
      z.array(AdminVerificationSchema),
      rows.map((v) => ({ ...toVerificationRequest(v), user: toPublicUser(v.user), vehicle: v.vehicle ? toVehicle(v.vehicle) : null })),
    );
  });

  for (const decision of ['approve', 'reject'] as const) {
    app.post(`/admin/verifications/:id/${decision}`, async (request) => {
      await requireAdmin(request);
      const { id } = IdParam.parse(request.params);
      const { note } = parse(ReviewVerificationSchema, request.body ?? {});
      const v = await prisma.verificationRequest.findUnique({ where: { id } });
      if (!v) throw notFound('That verification request');
      if (v.status !== 'pending') throw conflict('This request was already reviewed.', 'INVALID_TRANSITION');
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.verificationRequest.update({
          where: { id },
          data: { status: decision === 'approve' ? 'approved' : 'rejected', note: note ?? null, reviewedAt: now },
        });
        if (decision !== 'approve') return;
        if (v.type === 'email') await tx.user.update({ where: { id: v.userId }, data: { email: v.email, emailVerifiedAt: now } });
        if (v.type === 'id') await tx.user.update({ where: { id: v.userId }, data: { idVerifiedAt: now } });
        if (v.type === 'licence') await tx.user.update({ where: { id: v.userId }, data: { driverVerifiedAt: now } });
        if (v.type === 'vehicle' && v.vehicleId) await tx.vehicle.update({ where: { id: v.vehicleId }, data: { verifiedAt: now } });
      });
      const label = { email: 'Email', id: 'ID', licence: 'Driving licence', vehicle: 'Vehicle' }[v.type];
      await notify(v.userId, `verification_${decision}d`, {
        title: decision === 'approve' ? `${label} verified ✓` : `${label} not verified`,
        body: decision === 'approve' ? 'Your profile now shows the new verification.' : (note ?? 'Please resubmit a clearer document.'),
        href: '/verify',
      });
      realtime.toAdmins('admin:changed', { kind: 'verification' });
      const fresh = await prisma.verificationRequest.findUniqueOrThrow({ where: { id }, include: verificationInclude });
      return out(AdminVerificationSchema, {
        ...toVerificationRequest(fresh),
        user: toPublicUser(fresh.user),
        vehicle: fresh.vehicle ? toVehicle(fresh.vehicle) : null,
      });
    });
  }

  // ── reports & SOS ──
  const reportInclude = {
    reporter: { include: userInclude },
    reportedUser: { include: userInclude },
    booking: { select: { tripCode: true } },
  } as const;
  type ReportRow = Awaited<ReturnType<typeof prisma.report.findMany<{ include: typeof reportInclude }>>>[number];
  const toAdminReport = (r: ReportRow) => ({
    id: r.id,
    reporterId: r.reporterId,
    reportedUserId: r.reportedUserId,
    bookingId: r.bookingId,
    reason: r.reason as ReportReason,
    body: r.body,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reporter: toPublicUser(r.reporter),
    reportedUser: r.reportedUser ? toPublicUser(r.reportedUser) : null,
    tripCode: r.booking?.tripCode ?? null,
  });

  app.get('/admin/reports', async (request) => {
    await requireAdmin(request);
    const { status } = parse(AdminListQuerySchema, request.query);
    const rows = await prisma.report.findMany({
      where: status ? { status: status as never } : {},
      include: reportInclude,
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    });
    return out(z.array(AdminReportSchema), rows.map(toAdminReport));
  });

  app.patch('/admin/reports/:id', async (request) => {
    await requireAdmin(request);
    const { id } = IdParam.parse(request.params);
    const { status } = parse(UpdateReportSchema, request.body);
    if (!(await prisma.report.findUnique({ where: { id } }))) throw notFound('That report');
    const r = await prisma.report.update({ where: { id }, data: { status }, include: reportInclude });
    realtime.toAdmins('admin:changed', { kind: 'report' });
    return out(AdminReportSchema, toAdminReport(r));
  });

  const sosInclude = {
    user: { include: userInclude },
    booking: {
      include: {
        joinRequest: {
          include: { trip: { include: { driver: { include: userInclude }, stops: { include: { place: true }, orderBy: { order: 'asc' } } } } },
        },
      },
    },
  } as const;
  type SosRow = Awaited<ReturnType<typeof prisma.sosEvent.findMany<{ include: typeof sosInclude }>>>[number];
  const toAdminSos = (s: SosRow) => ({
    ...toSos(s),
    user: toPublicUser(s.user),
    tripCode: s.booking.tripCode,
    route: routeOf(s.booking.joinRequest.trip.stops),
    driver: toPublicUser(s.booking.joinRequest.trip.driver),
  });

  app.get('/admin/sos', async (request) => {
    await requireAdmin(request);
    const { status } = parse(AdminListQuerySchema, request.query);
    const rows = await prisma.sosEvent.findMany({
      where: status === 'resolved' ? { resolvedAt: { not: null } } : status === 'open' ? { resolvedAt: null } : {},
      include: sosInclude,
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    });
    return out(z.array(AdminSosSchema), rows.map(toAdminSos));
  });

  app.post('/admin/sos/:id/resolve', async (request) => {
    await requireAdmin(request);
    const { id } = IdParam.parse(request.params);
    if (!(await prisma.sosEvent.findUnique({ where: { id } }))) throw notFound('That SOS event');
    const s = await prisma.sosEvent.update({ where: { id }, data: { resolvedAt: new Date() }, include: sosInclude });
    realtime.toAdmins('admin:changed', { kind: 'sos' });
    return out(AdminSosSchema, toAdminSos(s));
  });

  app.get('/admin/outbox', async (request) => {
    await requireAdmin(request);
    const rows = await prisma.devOutbox.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return out(
      z.array(OutboxMessageSchema),
      rows.map((m) => ({ id: m.id, channel: m.channel as 'sms' | 'push', to: m.to, body: m.body, createdAt: m.createdAt.toISOString() })),
    );
  });
}
