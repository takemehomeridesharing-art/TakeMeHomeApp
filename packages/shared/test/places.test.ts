import { describe, expect, it } from 'vitest';
import { KIGALI_PLACES, ROAD_LINKS, buildCorridor, kigaliGraph, shortestPath, suggestCorridor } from '../src';

describe('places graph', () => {
  it('seeds the 15 Kigali points, all connected', () => {
    expect(KIGALI_PLACES).toHaveLength(15);
    for (const p of KIGALI_PLACES) expect(shortestPath('cbd', p.id)).not.toBeNull();
    for (const [a, b] of ROAD_LINKS) expect(kigaliGraph().adj.get(a)?.has(b)).toBe(true);
  });

  it('finds shortest paths symmetrically', () => {
    const there = shortestPath('kanombe', 'cbd')!;
    const back = shortestPath('cbd', 'kanombe')!;
    expect(there.placeIds).toEqual(['kanombe', 'giporoso', 'remera', 'kimihurura', 'cbd']);
    expect(back.placeIds).toEqual([...there.placeIds].reverse());
    expect(back.km).toBe(there.km);
    expect(shortestPath('cbd', 'atlantis')).toBeNull();
  });

  it('builds corridors with increasing cumulative km', () => {
    const c = buildCorridor(['nyamirambo', 'kimisagara', 'nyabugogo', 'cbd']);
    expect(c.map((s) => s.order)).toEqual([0, 1, 2, 3]);
    expect(c[0]!.cumulativeKm).toBe(0);
    for (let i = 1; i < c.length; i++) expect(c[i]!.cumulativeKm).toBeGreaterThan(c[i - 1]!.cumulativeKm);
    expect(() => buildCorridor(['cbd'])).toThrow();
    expect(() => buildCorridor(['cbd', 'remera', 'cbd'])).toThrow();
  });

  it('suggests the route stops plus nearby via places, and routes through chosen vias', () => {
    const s = suggestCorridor('nyamirambo', 'cbd')!;
    expect(s.route).toEqual(['nyamirambo', 'kimisagara', 'cbd']);
    expect(s.nearby).toContain('nyabugogo');
    const via = suggestCorridor('nyamirambo', 'cbd', ['nyabugogo'])!;
    expect(via.route).toEqual(['nyamirambo', 'kimisagara', 'nyabugogo', 'cbd']);
    expect(via.totalKm).toBeGreaterThan(s.totalKm);
    expect(suggestCorridor('cbd', 'cbd')).toBeNull();
  });
});
