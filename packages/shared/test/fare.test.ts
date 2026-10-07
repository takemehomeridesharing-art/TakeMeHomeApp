import { describe, expect, it } from 'vitest';
import {
  BOOKING_FEE,
  BOOKING_FEE_EV,
  RUNNING_COST_PER_KM,
  computeContribution,
  costSharingLedger,
  driverRecoveryCap,
  legOccupancy,
  round10,
  tripCost,
} from '../src';
import { prng } from './prng';

describe('round10', () => {
  it('rounds down to the nearest 10', () => {
    expect(round10(0)).toBe(0);
    expect(round10(9.99)).toBe(0);
    expect(round10(465)).toBe(460);
    expect(round10(470)).toBe(470);
  });
  it('absorbs floating point noise', () => {
    expect(round10((300 * 2) / 3)).toBe(200);
    expect(round10(199.99999999)).toBe(200);
  });
});

describe('computeContribution', () => {
  it('applies the capped formula with the driver counted as an occupant', () => {
    // Kimisagara → CBD on the seeded trip: 6.2 km, 3 seats → 300 × 6.2 / 4 = 465 → 460
    expect(computeContribution({ segmentKm: 6.2, seatsOffered: 3, isEV: false })).toEqual({
      costShare: 460,
      bookingFee: BOOKING_FEE,
      total: 610,
    });
  });
  it('charges the reduced fee for EV/hybrid trips', () => {
    const c = computeContribution({ segmentKm: 5.5, seatsOffered: 3, isEV: true });
    expect(c.bookingFee).toBe(BOOKING_FEE_EV);
    expect(c.costShare).toBe(410); // 300 × 5.5 / 4 = 412.5 → 410
    expect(c.total).toBe(510);
  });
  it('is monotonic in distance and decreasing in seats', () => {
    const a = computeContribution({ segmentKm: 3, seatsOffered: 2, isEV: false }).costShare;
    const b = computeContribution({ segmentKm: 6, seatsOffered: 2, isEV: false }).costShare;
    const c = computeContribution({ segmentKm: 6, seatsOffered: 4, isEV: false }).costShare;
    expect(b).toBeGreaterThan(a);
    expect(c).toBeLessThan(b);
  });
  it('rejects invalid seat counts and distances', () => {
    expect(() => computeContribution({ segmentKm: 5, seatsOffered: 0, isEV: false })).toThrow(RangeError);
    expect(() => computeContribution({ segmentKm: 5, seatsOffered: 5, isEV: false })).toThrow(RangeError);
    expect(() => computeContribution({ segmentKm: 5, seatsOffered: 2.5, isEV: false })).toThrow(RangeError);
    expect(() => computeContribution({ segmentKm: -1, seatsOffered: 2, isEV: false })).toThrow(RangeError);
    expect(() => computeContribution({ segmentKm: Number.NaN, seatsOffered: 2, isEV: false })).toThrow(RangeError);
  });
});

describe('driverRecoveryCap', () => {
  it('leaves the driver carrying at least their own share', () => {
    const cap = driverRecoveryCap({ totalKm: 8.7, seatsOffered: 3 });
    expect(cap.tripCost).toBe(2610);
    expect(cap.maxRecovery).toBe(3 * 650); // 300 × 8.7 / 4 = 652.5 → 650
    expect(cap.driverMinimumShare).toBeGreaterThanOrEqual(cap.tripCost / 4);
  });

  it('holds recovery < trip cost for every seat count and distance', () => {
    for (let seats = 1; seats <= 4; seats++) {
      for (let tenths = 1; tenths <= 1500; tenths++) {
        const totalKm = tenths / 10;
        const cap = driverRecoveryCap({ totalKm, seatsOffered: seats });
        expect(cap.maxRecovery).toBeLessThan(cap.tripCost);
        expect(cap.driverMinimumShare).toBeGreaterThan(0);
      }
    }
  });
});

describe('no-profit invariant (property-based)', () => {
  /**
   * For any seats 1–4, any corridor, and any set of paid segments that respects seat capacity
   * on every leg, the cost shares the driver recovers are strictly less than the trip's cost.
   */
  it('driver recovery < total trip cost for any feasible set of paid segments', () => {
    const rnd = prng(20261007);
    for (let run = 0; run < 5000; run++) {
      const seats = rnd.int(1, 4);
      const stopCount = rnd.int(2, 9);
      const km = [0];
      for (let i = 1; i < stopCount; i++) km.push(Math.round((km[i - 1]! + rnd.int(1, 120) / 10) * 10) / 10);
      const totalKm = km[stopCount - 1]!;

      // Greedily add random segments while capacity allows — including many short hops,
      // which is where rounding could bite.
      const segments: { boardOrder: number; alightOrder: number }[] = [];
      for (let attempt = 0; attempt < 40; attempt++) {
        const board = rnd.int(0, stopCount - 2);
        const alight = rnd.int(board + 1, stopCount - 1);
        const candidate = [...segments, { boardOrder: board, alightOrder: alight }];
        if (legOccupancy(stopCount, candidate).every((used) => used <= seats)) segments.push(candidate.at(-1)!);
      }

      const paid = segments.map(
        (s) => computeContribution({ segmentKm: km[s.alightOrder]! - km[s.boardOrder]!, seatsOffered: seats, isEV: rnd.next() < 0.3 }).costShare,
      );
      const ledger = costSharingLedger({ totalKm, seatsOffered: seats }, paid);
      expect(ledger.recovered).toBeLessThan(ledger.tripCost);
      expect(ledger.recovered).toBeLessThanOrEqual(ledger.maxRecovery);
      expect(ledger.driverCarries).toBeGreaterThan(0);
    }
  });

  it('a fully sold trip (every seat, whole route) still leaves the driver a share', () => {
    for (let seats = 1; seats <= 4; seats++) {
      const totalKm = 12.4;
      const share = computeContribution({ segmentKm: totalKm, seatsOffered: seats, isEV: false }).costShare;
      const ledger = costSharingLedger({ totalKm, seatsOffered: seats }, Array(seats).fill(share));
      expect(ledger.recovered).toBeLessThan(tripCost(totalKm));
      expect(ledger.driverCarries).toBeGreaterThanOrEqual(Math.floor((RUNNING_COST_PER_KM * totalKm) / (seats + 1)));
    }
  });

  it('booking fees are never counted as driver recovery', () => {
    const c = computeContribution({ segmentKm: 8.7, seatsOffered: 1, isEV: false });
    const ledger = costSharingLedger({ totalKm: 8.7, seatsOffered: 1 }, [c.costShare]);
    expect(ledger.recovered).toBe(c.costShare);
    expect(ledger.recovered).not.toBe(c.total);
  });
});
