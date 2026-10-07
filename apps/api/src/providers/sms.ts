import { prisma } from '../db';

/** Outbound SMS. Real implementation (e.g. an aggregator) is a drop-in later. */
export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<{ messageId: string }>;
}

/** Dev: prints to the console and records in the DevOutbox table (visible in admin → Outbox). */
export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock_sms';
  async send(to: string, body: string) {
    console.log(`\n📱 [mock SMS → ${to}] ${body}\n`);
    const row = await prisma.devOutbox.create({ data: { channel: 'sms', to, body } });
    return { messageId: row.id };
  }
}
