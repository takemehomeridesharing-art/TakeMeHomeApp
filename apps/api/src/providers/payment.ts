import type { FastifyInstance } from 'fastify';

/**
 * Mobile-money payment provider (MTN MoMo / Airtel Money). The payment service only talks to
 * this interface; nothing outside a provider knows whether it is real or simulated.
 */
export interface ChargeRequest {
  /** Our payment id — the provider's external reference. */
  externalId: string;
  amount: number;
  currency: 'RWF';
  /** Payer's mobile money number (+2507…). */
  msisdn: string;
  /** Shown on the payer's USSD prompt. */
  description: string;
  /** Used by providers that notify the payer in-app. */
  payerUserId: string;
}

export type ChargeStatus = 'pending' | 'confirmed' | 'failed';

export interface WebhookResult {
  providerRef: string;
  status: ChargeStatus;
  reason?: string;
}

export interface PaymentProvider {
  readonly name: string;
  /** Starts a collection (USSD push to the payer). Resolves once the provider accepted it. */
  initiateCharge(req: ChargeRequest): Promise<{ providerRef: string; status: 'pending' }>;
  /** Queries the authoritative status of a charge (called after a webhook, before trusting it). */
  confirmCharge(providerRef: string): Promise<{ status: ChargeStatus; reason?: string }>;
  /** Disburses money to a driver. */
  payout(req: { msisdn: string; amount: number; reference: string }): Promise<{ providerRef: string }>;
  /** Returns a confirmed charge to the payer. */
  refund(req: { providerRef: string; amount: number }): Promise<{ providerRef: string }>;
  /** Webhook handler signature: verifies and parses the provider's callback. */
  parseWebhook(headers: Record<string, unknown>, body: unknown): WebhookResult;
  /** Optional provider-specific routes (e.g. a sandbox simulator). */
  registerRoutes?(app: FastifyInstance): void;
}
