import type { Notification as NotificationDto } from '@tmh/shared';
import type { Notification, Prisma } from '@prisma/client';
import { prisma } from '../db';
import { providers } from '../providers';
import { realtime } from '../realtime';

export interface NotificationContent {
  title: string;
  body: string;
  /** In-app deep link, e.g. `/booking/abc`. */
  href?: string;
}

export function toNotificationDto(n: Notification): NotificationDto {
  const payload = (n.payload ?? {}) as Record<string, unknown>;
  return {
    id: n.id,
    type: n.type,
    title: String(payload.title ?? ''),
    body: String(payload.body ?? ''),
    href: typeof payload.href === 'string' ? payload.href : null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

/** In-app notification centre + realtime event + (mock) device push. */
export async function notify(userId: string, type: string, content: NotificationContent): Promise<void> {
  const row = await prisma.notification.create({
    data: { userId, type, payload: { ...content } as Prisma.InputJsonObject },
  });
  realtime.toUser(userId, 'notification', toNotificationDto(row));
  await providers().push.send(userId, content.title, content.body, { href: content.href });
}

export async function notifyAdmins(type: string, content: NotificationContent) {
  const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, type, content)));
}
