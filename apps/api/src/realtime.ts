import type { Server as HttpServer } from 'node:http';
import type { ServerToClientEvents } from '@tmh/shared';
import { Server } from 'socket.io';
import { prisma } from './db';

type EventName = keyof ServerToClientEvents;
type Payload<E extends EventName> = Parameters<ServerToClientEvents[E]>[0];

/**
 * Socket.IO fan-out. Each socket joins `user:<id>`; admins also join `admins`.
 * Services call `toUser` / `toAdmins` and never touch sockets directly.
 */
class Realtime {
  private io: Server<Record<string, never>, ServerToClientEvents> | undefined;

  attach(server: HttpServer, verifyToken: (token: string) => { sub: string }) {
    this.io = new Server(server, { cors: { origin: true, credentials: true } });
    this.io.use(async (socket, next) => {
      try {
        const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
        if (!token) return next(new Error('UNAUTHORIZED'));
        const { sub } = verifyToken(token);
        const user = await prisma.user.findUnique({ where: { id: sub }, select: { id: true, isAdmin: true } });
        if (!user) return next(new Error('UNAUTHORIZED'));
        socket.data.userId = user.id;
        await socket.join(`user:${user.id}`);
        if (user.isAdmin) await socket.join('admins');
        next();
      } catch {
        next(new Error('UNAUTHORIZED'));
      }
    });
    return this.io;
  }

  toUser<E extends EventName>(userId: string, event: E, payload: Payload<E>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.io?.to(`user:${userId}`).emit as any)?.(event, payload);
  }

  toUsers<E extends EventName>(userIds: readonly string[], event: E, payload: Payload<E>) {
    for (const id of new Set(userIds)) this.toUser(id, event, payload);
  }

  toAdmins<E extends EventName>(event: E, payload: Payload<E>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.io?.to('admins').emit as any)?.(event, payload);
  }

  async close() {
    await this.io?.close();
    this.io = undefined;
  }
}

export const realtime = new Realtime();
