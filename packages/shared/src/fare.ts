import { BOOKING_FEE, BOOKING_FEE_EV, MAX_SEATS, MIN_SEATS, RUNNING_COST_PER_KM } from './constants';

/**
 * The pricing engine. Drivers never set prices: a passenger's cost share is
 *
 *   costShare = round10(RUNNING_COST_PER_KM × segmentKm ÷ (seatsOffered + 1))
 *
 * The driver is counted as an occupant (+1), so even with every seat sold for the whole
 * route the driver still carries their own share of the running cost. The booking fee is
 * platform revenue and never reaches the driver.
 */

/**
 * Rounds DOWN to the nearest RWF 10. Rounding is never in the driver's favour, which keeps
 * the no-profit invariant exact for every segment length (rounding to nearest could push
 * many very short segments over the cost).
 */
export function round10(amount: number): number {
  const clean = Math.round(amount * 1e6) / 1e6; // absorb float noise like 199.99999997
  return Math.floor(clean / 10) * 10;
}

export interface ContributionInput {
  segmentKm: number;
  seatsOffered: number;
  isEV: boolean;
}

export interface Contribution {
  /** Goes to the driver: the passenger's share of the vehicle running cost. */
  costShare: number;
  /** Platform booking fee (RWF 150, RWF 100 for EV/hybrid trips). */
  bookingFee: number;
  /** What the passenger pays. */
  total: number;
}

function assertSeats(seatsOffered: number): void {
  if (!Number.isInteger(seatsOffered) || seatsOffered < MIN_SEATS || seatsOffered > MAX_SEATS) {
    throw new RangeError(`seatsOffered must be an integer between ${MIN_SEATS} and ${MAX_SEATS}`);
  }
}

export function bookingFeeFor(isEV: boolean): number {
  return isEV ? BOOKING_FEE_EV : BOOKING_FEE;
}

export function computeContribution({ segmentKm, seatsOffered, isEV }: ContributionInput): Contribution {
  assertSeats(seatsOffered);
  if (!Number.isFinite(segmentKm) || segmentKm < 0) throw new RangeError('segmentKm must be a non-negative number');
  const costShare = round10((RUNNING_COST_PER_KM * segmentKm) / (seatsOffered + 1));
  const bookingFee = bookingFeeFor(isEV);
  return { costShare, bookingFee, total: costShare + bookingFee };
}

/** Running cost of driving the full corridor, in RWF. */
export function tripCost(totalKm: number): number {
  return Math.round(RUNNING_COST_PER_KM * totalKm);
}

export interface RecoveryCap {
  /** What the whole trip costs to run. */
  tripCost: number;
  /** The most the driver can ever recover: every seat sold for the full route. */
  maxRecovery: number;
  /** What the driver still carries in that best case (always > 0). */
  driverMinimumShare: number;
}

/**
 * The ceiling on what a driver can recover for a trip. `maxRecovery < tripCost` holds for every
 * valid trip because each seat recovers at most 1/(seats+1) of the cost per km and capacity
 * limits paid seat-km to seats × totalKm.
 */
export function driverRecoveryCap(trip: { totalKm: number; seatsOffered: number }): RecoveryCap {
  assertSeats(trip.seatsOffered);
  if (!(trip.totalKm > 0)) throw new RangeError('totalKm must be positive');
  const cost = tripCost(trip.totalKm);
  const perSeat = computeContribution({ segmentKm: trip.totalKm, seatsOffered: trip.seatsOffered, isEV: false }).costShare;
  const maxRecovery = perSeat * trip.seatsOffered;
  return { tripCost: cost, maxRecovery, driverMinimumShare: cost - maxRecovery };
}

export interface CostSharingLedger {
  tripCost: number;
  /** Sum of cost shares from paid passengers. Booking fees are excluded. */
  recovered: number;
  /** The share of the running cost the driver still carries. */
  driverCarries: number;
  maxRecovery: number;
}

/** The driver's ledger for a trip given the cost shares already paid. */
export function costSharingLedger(
  trip: { totalKm: number; seatsOffered: number },
  paidCostShares: readonly number[],
): CostSharingLedger {
  const cap = driverRecoveryCap(trip);
  const recovered = paidCostShares.reduce((sum, x) => sum + x, 0);
  return { tripCost: cap.tripCost, recovered, driverCarries: cap.tripCost - recovered, maxRecovery: cap.maxRecovery };
}
