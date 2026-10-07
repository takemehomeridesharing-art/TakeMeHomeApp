/**
 * Segment-aware seat capacity. A corridor with n stops has n-1 legs; leg i runs from stop
 * order i to i+1. A passenger riding board→alight occupies legs [board, alight).
 */

export interface OccupiedSegment {
  boardOrder: number;
  alightOrder: number;
}

/** Number of passengers on each leg of a corridor with `stopCount` stops. */
export function legOccupancy(stopCount: number, segments: readonly OccupiedSegment[]): number[] {
  const legs = new Array<number>(Math.max(0, stopCount - 1)).fill(0);
  for (const s of segments) {
    for (let i = s.boardOrder; i < s.alightOrder && i < legs.length; i++) legs[i]! += 1;
  }
  return legs;
}

/** Seats free for the whole of board→alight (the tightest leg decides). */
export function seatsAvailable(
  seatsOffered: number,
  stopCount: number,
  segments: readonly OccupiedSegment[],
  boardOrder = 0,
  alightOrder = stopCount - 1,
): number {
  const legs = legOccupancy(stopCount, segments);
  let maxUsed = 0;
  for (let i = boardOrder; i < alightOrder; i++) maxUsed = Math.max(maxUsed, legs[i] ?? 0);
  return Math.max(0, seatsOffered - maxUsed);
}

/** A trip is full when no leg has a free seat — nobody could join anywhere. */
export function isTripFull(seatsOffered: number, stopCount: number, segments: readonly OccupiedSegment[]): boolean {
  const legs = legOccupancy(stopCount, segments);
  return legs.length > 0 && legs.every((used) => used >= seatsOffered);
}
