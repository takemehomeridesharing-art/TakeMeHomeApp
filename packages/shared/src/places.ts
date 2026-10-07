/**
 * The Kigali places graph: named pickup/drop-off points and the road links between them.
 *
 * Phase 2 will replace named stops with geo-radius matching; everything that needs distances
 * goes through `shortestPath` / `buildCorridor` so that swap stays local to this file.
 */

export interface PlaceSeed {
  id: string;
  name: string;
  lat: number;
  lng: number;
  landmark: string;
}

export const KIGALI_PLACES: readonly PlaceSeed[] = [
  { id: 'nyamirambo', name: 'Nyamirambo', lat: -1.9806, lng: 30.0445, landmark: 'Nyamirambo stadium roundabout' },
  { id: 'kimisagara', name: 'Kimisagara', lat: -1.9637, lng: 30.0478, landmark: 'Kimisagara youth centre' },
  { id: 'nyabugogo', name: 'Nyabugogo', lat: -1.9389, lng: 30.0443, landmark: 'Nyabugogo bus park gate' },
  { id: 'cbd', name: 'CBD', lat: -1.9497, lng: 30.0588, landmark: 'Kigali City Tower' },
  { id: 'kimihurura', name: 'Kimihurura', lat: -1.9520, lng: 30.0870, landmark: 'Kigali Convention Centre roundabout' },
  { id: 'kacyiru', name: 'Kacyiru', lat: -1.9390, lng: 30.0860, landmark: 'Kacyiru police HQ' },
  { id: 'kinamba', name: 'Kinamba', lat: -1.9345, lng: 30.0662, landmark: 'Kinamba interchange' },
  { id: 'gisozi', name: 'Gisozi', lat: -1.9175, lng: 30.0645, landmark: 'Kigali Genocide Memorial' },
  { id: 'remera', name: 'Remera', lat: -1.9575, lng: 30.1110, landmark: 'Amahoro stadium gate' },
  { id: 'giporoso', name: 'Giporoso', lat: -1.9630, lng: 30.1255, landmark: 'Giporoso bus stop' },
  { id: 'kanombe', name: 'Kanombe', lat: -1.9690, lng: 30.1420, landmark: 'Kanombe military hospital gate' },
  { id: 'kicukiro', name: 'Kicukiro', lat: -1.9770, lng: 30.1030, landmark: 'Kicukiro Centre' },
  { id: 'sonatube', name: 'Sonatube', lat: -1.9685, lng: 30.0950, landmark: 'Sonatube junction' },
  { id: 'rwandex', name: 'Rwandex', lat: -1.9655, lng: 30.0790, landmark: 'Rwandex roundabout' },
  { id: 'kimironko', name: 'Kimironko', lat: -1.9455, lng: 30.1255, landmark: 'Kimironko market' },
] as const;

/** Undirected road links between places. Distances are derived (see `edgeKm`). */
export const ROAD_LINKS: readonly (readonly [string, string])[] = [
  ['nyamirambo', 'kimisagara'],
  ['kimisagara', 'nyabugogo'],
  ['kimisagara', 'cbd'],
  ['nyabugogo', 'cbd'],
  ['nyabugogo', 'kinamba'],
  ['kinamba', 'gisozi'],
  ['kinamba', 'kacyiru'],
  ['cbd', 'kinamba'],
  ['cbd', 'kimihurura'],
  ['cbd', 'rwandex'],
  ['kimihurura', 'kacyiru'],
  ['kimihurura', 'remera'],
  ['kacyiru', 'kimironko'],
  ['remera', 'kimironko'],
  ['remera', 'giporoso'],
  ['giporoso', 'kanombe'],
  ['rwandex', 'sonatube'],
  ['sonatube', 'kicukiro'],
  ['sonatube', 'remera'],
  ['kicukiro', 'kanombe'],
];

/** Kigali roads are winding; straight-line distance × this factor ≈ driving distance. */
export const ROAD_FACTOR = 1.3;

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface PlacesGraph {
  places: Map<string, PlaceSeed>;
  /** adjacency: placeId → (neighbourId → km) */
  adj: Map<string, Map<string, number>>;
}

export function buildGraph(
  places: readonly PlaceSeed[] = KIGALI_PLACES,
  links: readonly (readonly [string, string])[] = ROAD_LINKS,
): PlacesGraph {
  const byId = new Map(places.map((p) => [p.id, p]));
  const adj = new Map<string, Map<string, number>>();
  for (const p of places) adj.set(p.id, new Map());
  for (const [a, b] of links) {
    const pa = byId.get(a);
    const pb = byId.get(b);
    if (!pa || !pb) throw new Error(`Road link references unknown place: ${a}–${b}`);
    const km = round1(haversineKm(pa, pb) * ROAD_FACTOR);
    adj.get(a)!.set(b, km);
    adj.get(b)!.set(a, km);
  }
  return { places: byId, adj };
}

let defaultGraph: PlacesGraph | undefined;
export function kigaliGraph(): PlacesGraph {
  defaultGraph ??= buildGraph();
  return defaultGraph;
}

export function getPlace(id: string, graph: PlacesGraph = kigaliGraph()): PlaceSeed | undefined {
  return graph.places.get(id);
}

/** Dijkstra over the places graph. Returns null when unreachable or unknown. */
export function shortestPath(
  fromId: string,
  toId: string,
  graph: PlacesGraph = kigaliGraph(),
): { placeIds: string[]; km: number } | null {
  if (!graph.adj.has(fromId) || !graph.adj.has(toId)) return null;
  if (fromId === toId) return { placeIds: [fromId], km: 0 };
  const dist = new Map<string, number>([[fromId, 0]]);
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  while (true) {
    let current: string | undefined;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d;
        current = id;
      }
    }
    if (current === undefined) return null;
    if (current === toId) break;
    visited.add(current);
    for (const [next, km] of graph.adj.get(current)!) {
      const nd = best + km;
      if (nd < (dist.get(next) ?? Infinity)) {
        dist.set(next, nd);
        prev.set(next, current);
      }
    }
  }
  const placeIds = [toId];
  while (placeIds[0] !== fromId) placeIds.unshift(prev.get(placeIds[0]!)!);
  return { placeIds, km: round1(dist.get(toId)!) };
}

export interface CorridorStop {
  placeId: string;
  /** 0-based position along the corridor; first = origin, last = destination. */
  order: number;
  /** Driving distance from the origin to this stop. */
  cumulativeKm: number;
}

/**
 * Builds the ordered corridor for a list of stops the driver will serve, in driving order.
 * Distances between consecutive stops are shortest-path km over the graph.
 */
export function buildCorridor(stopPlaceIds: readonly string[], graph: PlacesGraph = kigaliGraph()): CorridorStop[] {
  if (stopPlaceIds.length < 2) throw new Error('A corridor needs at least an origin and a destination');
  if (new Set(stopPlaceIds).size !== stopPlaceIds.length) throw new Error('A corridor cannot visit the same stop twice');
  const stops: CorridorStop[] = [];
  let km = 0;
  stopPlaceIds.forEach((placeId, order) => {
    if (order > 0) {
      const leg = shortestPath(stopPlaceIds[order - 1]!, placeId, graph);
      if (!leg) throw new Error(`No road connection between ${stopPlaceIds[order - 1]} and ${placeId}`);
      km = round1(km + leg.km);
    } else if (!graph.places.has(placeId)) {
      throw new Error(`Unknown place: ${placeId}`);
    }
    stops.push({ placeId, order, cumulativeKm: km });
  });
  return stops;
}

export interface CorridorSuggestion {
  /** Every place on the driving route, in order (origin … destination). */
  route: string[];
  totalKm: number;
  /** Places on the route the driver can serve (all on by default). */
  onRoute: string[];
  /** Places just off the route (≤ `nearbyKm` from it) the driver may add as a via stop. */
  nearby: string[];
}

/**
 * Suggests a corridor from → to, optionally forced through via places.
 * Via places are visited in order of their distance from the origin.
 */
export function suggestCorridor(
  fromId: string,
  toId: string,
  viaIds: readonly string[] = [],
  graph: PlacesGraph = kigaliGraph(),
  nearbyKm = 3,
): CorridorSuggestion | null {
  if (fromId === toId) return null;
  const vias = [...new Set(viaIds)]
    .filter((id) => id !== fromId && id !== toId)
    .map((id) => ({ id, d: shortestPath(fromId, id, graph)?.km ?? Infinity }))
    .sort((a, b) => a.d - b.d)
    .map((v) => v.id);
  const waypoints = [fromId, ...vias, toId];
  const route: string[] = [fromId];
  let totalKm = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const leg = shortestPath(waypoints[i - 1]!, waypoints[i]!, graph);
    if (!leg) return null;
    for (const id of leg.placeIds.slice(1)) {
      if (route.includes(id)) return null; // would double back on itself
      route.push(id);
    }
    totalKm += leg.km;
  }
  const onRouteSet = new Set(route);
  const nearby = [...graph.places.values()]
    .filter((p) => !onRouteSet.has(p.id))
    .filter((p) => route.some((r) => (graph.adj.get(r)?.get(p.id) ?? Infinity) <= nearbyKm))
    .map((p) => p.id);
  return { route, totalKm: round1(totalKm), onRoute: route, nearby };
}
