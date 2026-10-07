import type { PaymentProvider } from './payment';
import type { PushProvider } from './push';
import type { SmsProvider } from './sms';

/** The active provider set, chosen once in `buildApp`. */
export interface Providers {
  payment: PaymentProvider;
  sms: SmsProvider;
  push: PushProvider;
}

let active: Providers | undefined;

export function setProviders(p: Providers) {
  active = p;
}

export function providers(): Providers {
  if (!active) throw new Error('Providers not initialised — call setProviders() in buildApp');
  return active;
}
