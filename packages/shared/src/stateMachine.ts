/**
 * Allowed status transitions. The API applies these inside transactions and rejects any
 * other move with 409 INVALID_TRANSITION. See PLAN.md for the diagram.
 */

export const TRIP_STATUSES = ['published', 'full', 'in_progress', 'completed', 'cancelled'] as const;
export const JOIN_REQUEST_STATUSES = ['pending', 'accepted', 'declined', 'cancelled', 'expired'] as const;
export const BOOKING_STATUSES = ['confirmed', 'completed', 'no_show', 'refunded'] as const;
export const PAYMENT_STATUSES = ['initiated', 'confirmed', 'failed', 'refunded'] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

type Machine<S extends string> = Readonly<Record<S, readonly S[]>>;

export const TRIP_TRANSITIONS: Machine<TripStatus> = {
  published: ['full', 'in_progress', 'cancelled'],
  full: ['published', 'in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

/**
 * pending → accepted | declined | cancelled (passenger) | expired (trip started/cancelled)
 * accepted → cancelled (passenger, before paying) | expired (trip started/cancelled unpaid)
 * Paying an accepted request creates a Booking; the request itself stays `accepted`.
 */
export const JOIN_REQUEST_TRANSITIONS: Machine<JoinRequestStatus> = {
  pending: ['accepted', 'declined', 'cancelled', 'expired'],
  accepted: ['cancelled', 'expired'],
  declined: [],
  cancelled: [],
  expired: [],
};

export const BOOKING_TRANSITIONS: Machine<BookingStatus> = {
  confirmed: ['completed', 'no_show', 'refunded'],
  completed: [],
  no_show: [],
  refunded: [],
};

export const PAYMENT_TRANSITIONS: Machine<PaymentStatus> = {
  initiated: ['confirmed', 'failed'],
  confirmed: ['refunded'],
  failed: [],
  refunded: [],
};

export class TransitionError extends Error {
  constructor(
    readonly entity: string,
    readonly from: string,
    readonly to: string,
  ) {
    super(`Cannot move ${entity} from "${from}" to "${to}"`);
    this.name = 'TransitionError';
  }
}

export function canTransition<S extends string>(machine: Machine<S>, from: S, to: S): boolean {
  return machine[from]?.includes(to) ?? false;
}

export function assertTransition<S extends string>(entity: string, machine: Machine<S>, from: S, to: S): void {
  if (!canTransition(machine, from, to)) throw new TransitionError(entity, from, to);
}

/** Join requests that hold a seat on the trip (pending ones do not). */
export const SEAT_HOLDING_REQUEST_STATUSES: readonly JoinRequestStatus[] = ['accepted'];
