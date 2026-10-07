import { randomBytes } from 'node:crypto';
import type { MomoPrompt } from '@tmh/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../errors';
import type { ChargeRequest, ChargeStatus, PaymentProvider, WebhookResult } from './payment';

interface MockCharge {
  req: ChargeRequest;
  status: ChargeStatus;
  reason?: string;
}

const WebhookBody = z.object({
  referenceId: z.string(),
  status: z.enum(['SUCCESSFUL', 'FAILED']),
  reason: z.string().optional(),
});

/**
 * Simulates MTN MoMo "request to pay": after `promptDelayMs` the payer's phone shows a USSD
 * prompt (here: a `momo:prompt` socket event the app renders as a dev control). The payer's
 * answer goes to `/dev/momo/:providerRef/respond`, which calls our webhook exactly like MTN
 * would — so the payment service sees the real flow: initiate → webhook → confirm.
 */
export class MockMomoProvider implements PaymentProvider {
  readonly name = 'mtn_momo';
  private charges = new Map<string, MockCharge>();

  constructor(
    private readonly deps: {
      promptDelayMs: number;
      /** Delivers the simulated USSD prompt to the payer's device. */
      showPrompt: (userId: string, prompt: MomoPrompt) => void;
    },
  ) {}

  async initiateCharge(req: ChargeRequest) {
    const providerRef = `MOMO-${randomBytes(6).toString('hex').toUpperCase()}`;
    this.charges.set(providerRef, { req, status: 'pending' });
    console.log(`💸 [mock MoMo] request-to-pay ${providerRef}: RWF ${req.amount} from ${req.msisdn}`);
    setTimeout(() => {
      if (this.charges.get(providerRef)?.status !== 'pending') return;
      this.deps.showPrompt(req.payerUserId, {
        paymentId: req.externalId,
        providerRef,
        amount: req.amount,
        msisdn: req.msisdn,
        merchant: 'TAKE ME HOME',
      });
    }, this.deps.promptDelayMs).unref();
    return { providerRef, status: 'pending' as const };
  }

  async confirmCharge(providerRef: string) {
    const charge = this.charges.get(providerRef);
    if (!charge) return { status: 'failed' as const, reason: 'Unknown transaction' };
    return { status: charge.status, reason: charge.reason };
  }

  async payout(req: { msisdn: string; amount: number; reference: string }) {
    const providerRef = `MOMO-PAYOUT-${randomBytes(5).toString('hex').toUpperCase()}`;
    console.log(`💸 [mock MoMo] disbursement ${providerRef}: RWF ${req.amount} → ${req.msisdn} (${req.reference})`);
    return { providerRef };
  }

  async refund(req: { providerRef: string; amount: number }) {
    const providerRef = `MOMO-REFUND-${randomBytes(5).toString('hex').toUpperCase()}`;
    console.log(`💸 [mock MoMo] refund ${providerRef}: RWF ${req.amount} for ${req.providerRef}`);
    return { providerRef };
  }

  parseWebhook(_headers: Record<string, unknown>, body: unknown): WebhookResult {
    const b = WebhookBody.parse(body);
    return { providerRef: b.referenceId, status: b.status === 'SUCCESSFUL' ? 'confirmed' : 'failed', reason: b.reason };
  }

  registerRoutes(app: FastifyInstance) {
    // The simulated handset answering the USSD prompt.
    app.post('/dev/momo/:providerRef/respond', async (request) => {
      const { providerRef } = z.object({ providerRef: z.string() }).parse(request.params);
      const { approve } = z.object({ approve: z.boolean() }).parse(request.body);
      const charge = this.charges.get(providerRef);
      if (!charge) throw notFound('That MoMo transaction');
      if (charge.status === 'pending') {
        charge.status = approve ? 'confirmed' : 'failed';
        charge.reason = approve ? undefined : 'Payer declined the MoMo prompt';
      }
      // MTN calls our callback URL; we do the same through the real webhook route.
      const res = await app.inject({
        method: 'POST',
        url: `/payments/webhook/${this.name}`,
        payload: {
          referenceId: providerRef,
          status: charge.status === 'confirmed' ? 'SUCCESSFUL' : 'FAILED',
          reason: charge.reason,
        },
      });
      return { ok: true, webhookStatus: res.statusCode };
    });
  }
}
