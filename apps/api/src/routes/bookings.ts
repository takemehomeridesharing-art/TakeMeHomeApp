import {
  BlockSchema,
  BlockedUserSchema,
  BookingSchema,
  ChatMessageSchema,
  CreateRatingSchema,
  CreateReportSchema,
  HistoryItemSchema,
  MarkReadSchema,
  NotificationSchema,
  OkSchema,
  RatingSchema,
  ReportSchema,
  SendMessageSchema,
  SosEventSchema,
  SosSchema,
  type ReportReason,
} from '@tmh/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth';
import { prisma } from '../db';
import { conflict, notFound, out, parse } from '../errors';
import {
  createReport,
  getBooking,
  history,
  listMessages,
  listMyBookings,
  rateBooking,
  sendMessage,
  triggerSos,
} from '../services/bookings';
import { toNotificationDto } from '../services/notify';
import { toPublicUser, userInclude } from '../services/serialize';

const IdParam = z.object({ id: z.string() });

export async function bookingRoutes(app: FastifyInstance) {
  app.get('/bookings/mine', async (request) => {
    const me = await requireUser(request);
    return out(z.array(BookingSchema), await listMyBookings(me));
  });
  app.get('/bookings/:id', async (request) => {
    const me = await requireUser(request);
    return out(BookingSchema, await getBooking(me, IdParam.parse(request.params).id));
  });

  app.get('/bookings/:id/messages', async (request) => {
    const me = await requireUser(request);
    return out(z.array(ChatMessageSchema), await listMessages(me, IdParam.parse(request.params).id));
  });
  app.post('/bookings/:id/messages', async (request) => {
    const me = await requireUser(request);
    const { body } = parse(SendMessageSchema, request.body);
    return out(ChatMessageSchema, await sendMessage(me, IdParam.parse(request.params).id, body));
  });

  app.post('/bookings/:id/ratings', async (request) => {
    const me = await requireUser(request);
    const input = parse(CreateRatingSchema, request.body);
    return out(RatingSchema, await rateBooking(me, IdParam.parse(request.params).id, input));
  });

  app.post('/bookings/:id/sos', async (request) => {
    const me = await requireUser(request);
    const loc = parse(SosSchema, request.body ?? {});
    return out(SosEventSchema, await triggerSos(me, IdParam.parse(request.params).id, loc));
  });

  app.post('/reports', async (request) => {
    const me = await requireUser(request);
    const input = parse(CreateReportSchema, request.body);
    const r = await createReport(me, input);
    return out(ReportSchema, {
      id: r.id,
      reporterId: r.reporterId,
      reportedUserId: r.reportedUserId,
      bookingId: r.bookingId,
      reason: r.reason as ReportReason,
      body: r.body,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    });
  });

  app.get('/blocks', async (request) => {
    const me = await requireUser(request);
    const rows = await prisma.block.findMany({
      where: { blockerId: me.id },
      include: { blocked: { include: userInclude } },
      orderBy: { createdAt: 'desc' },
    });
    return out(
      z.array(BlockedUserSchema),
      rows.map((b) => ({ user: toPublicUser(b.blocked), createdAt: b.createdAt.toISOString() })),
    );
  });
  app.post('/blocks', async (request) => {
    const me = await requireUser(request);
    const { userId } = parse(BlockSchema, request.body);
    if (userId === me.id) throw conflict('You can’t block yourself.');
    if (!(await prisma.user.findUnique({ where: { id: userId } }))) throw notFound('That user');
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: me.id, blockedId: userId } },
      create: { blockerId: me.id, blockedId: userId },
      update: {},
    });
    return out(OkSchema, { ok: true });
  });
  app.delete('/blocks/:userId', async (request) => {
    const me = await requireUser(request);
    const { userId } = z.object({ userId: z.string() }).parse(request.params);
    await prisma.block.deleteMany({ where: { blockerId: me.id, blockedId: userId } });
    return out(OkSchema, { ok: true });
  });

  app.get('/notifications', async (request) => {
    const me = await requireUser(request);
    const rows = await prisma.notification.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return out(z.array(NotificationSchema), rows.map(toNotificationDto));
  });
  app.post('/notifications/read', async (request) => {
    const me = await requireUser(request);
    const { ids } = parse(MarkReadSchema, request.body ?? {});
    await prisma.notification.updateMany({
      where: { userId: me.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return out(OkSchema, { ok: true });
  });

  app.get('/history', async (request) => {
    const me = await requireUser(request);
    return out(z.array(HistoryItemSchema), await history(me));
  });
}
