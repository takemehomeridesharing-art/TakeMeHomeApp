import { prisma } from '../db';

/** Device push notifications. For now the app uses the in-app centre + Socket.IO. */
export interface PushProvider {
  readonly name: string;
  send(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<void>;
}

export class MockPushProvider implements PushProvider {
  readonly name = 'mock_push';
  async send(userId: string, title: string, body: string) {
    await prisma.devOutbox.create({ data: { channel: 'push', to: userId, body: `${title} — ${body}` } });
  }
}
