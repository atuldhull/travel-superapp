/**
 * offline-router — a tiny shortest-path engine over road geometry
 * extracted from the *already-rendered* vector tiles.
 *
 * The downloaded PMTiles area renders the Protomaps `roads` layer;
 * MapLibre can hand back those road LineStrings as GeoJSON. We snap
 * their vertices to a coarse grid (so segments that meet at junctions
 * and tile seams share a node), weight each edge by real ground
 * distance, and run Dijkstra. When the device GPS shows the traveller
 * has left the active route, we recompute from their position to the
 * destination — entirely on-device, no routing server.
 *
 * Honest scope: this is geometric shortest-path over OSM lines. It
 * follows roads and reroutes on a wrong turn (what was asked), but it
 * does not model turn restrictions, one-ways beyond what the tiles
 * encode, or live traffic. It is bounded to the downloaded area.
 *
 * Pure + dependency-free so it is trivially testable.
 *
 * Installed for the offline-region feature.
 */

/** `[lng, lat]` — GeoJSON axis order. */
export type LngLat = readonly [number, number];

export interface RoadGraph {
  readonly nodes: Map<string, LngLat>;
  readonly adj: Map<string, ReadonlyArray<{ readonly to: string; readonly w: number }>>;
}

/** ~1e-4° ≈ 11 m: bridges tile-seam vertex noise so junctions connect. */
const SNAP = 1e-4;
const EARTH_R = 6_371_000;

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

export function haversineMeters(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const la1 = toRad(a[1]);
  const la2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function key(p: LngLat): string {
  return `${Math.round(p[0] / SNAP)}:${Math.round(p[1] / SNAP)}`;
}

/**
 * Build an undirected weighted graph from drivable road polylines.
 * Each input is a list of `[lng, lat]` vertices for one way.
 */
export function buildRoadGraph(lines: ReadonlyArray<ReadonlyArray<LngLat>>): RoadGraph {
  const nodes = new Map<string, LngLat>();
  const adj = new Map<string, { to: string; w: number }[]>();

  const link = (ak: string, bk: string, w: number): void => {
    let list = adj.get(ak);
    if (!list) {
      list = [];
      adj.set(ak, list);
    }
    // Keep the cheapest parallel edge only.
    const existing = list.find((e) => e.to === bk);
    if (existing) {
      if (w < existing.w) existing.w = w;
    } else {
      list.push({ to: bk, w });
    }
  };

  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!;
      const b = line[i]!;
      const ak = key(a);
      const bk = key(b);
      if (ak === bk) continue;
      if (!nodes.has(ak)) nodes.set(ak, a);
      if (!nodes.has(bk)) nodes.set(bk, b);
      const w = haversineMeters(a, b);
      link(ak, bk, w);
      link(bk, ak, w);
    }
  }
  return { nodes, adj };
}

export function nearestNodeKey(graph: RoadGraph, p: LngLat): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const [k, ll] of graph.nodes) {
    const d = haversineMeters(p, ll);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

// Minimal binary min-heap keyed by number priority.
class MinHeap {
  private readonly h: { k: string; d: number }[] = [];

  get size(): number {
    return this.h.length;
  }

  push(k: string, d: number): void {
    const h = this.h;
    h.push({ k, d });
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p]!.d <= h[i]!.d) break;
      [h[p], h[i]] = [h[i]!, h[p]!];
      i = p;
    }
  }

  pop(): { k: string; d: number } | undefined {
    const h = this.h;
    const top = h[0];
    const last = h.pop();
    if (h.length > 0 && last) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let s = i;
        if (l < h.length && h[l]!.d < h[s]!.d) s = l;
        if (r < h.length && h[r]!.d < h[s]!.d) s = r;
        if (s === i) break;
        [h[s], h[i]] = [h[i]!, h[s]!];
        i = s;
      }
    }
    return top;
  }
}

/**
 * Shortest drivable path from `from` to `to`. Returns a polyline that
 * starts at the exact `from`, follows graph nodes, and ends at the
 * exact `to` (so the drawn line connects to the live position and the
 * destination). `null` when the area has no usable road graph between
 * the points.
 */
export function shortestPath(graph: RoadGraph, from: LngLat, to: LngLat): LngLat[] | null {
  if (graph.nodes.size === 0) return null;
  const startK = nearestNodeKey(graph, from);
  const goalK = nearestNodeKey(graph, to);
  if (!startK || !goalK || startK === goalK) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const done = new Set<string>();
  const pq = new MinHeap();
  dist.set(startK, 0);
  pq.push(startK, 0);

  while (pq.size > 0) {
    const cur = pq.pop()!;
    if (done.has(cur.k)) continue;
    done.add(cur.k);
    if (cur.k === goalK) break;
    const edges = graph.adj.get(cur.k);
    if (!edges) continue;
    for (const e of edges) {
      if (done.has(e.to)) continue;
      const nd = cur.d + e.w;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, cur.k);
        pq.push(e.to, nd);
      }
    }
  }

  if (!done.has(goalK)) return null;
  const rev: LngLat[] = [];
  let k: string | undefined = goalK;
  let guard = 0;
  while (k && guard++ < 100_000) {
    const ll = graph.nodes.get(k);
    if (ll) rev.push(ll);
    if (k === startK) break;
    k = prev.get(k);
  }
  rev.reverse();
  if (rev.length < 2) return null;
  return [from, ...rev, to];
}

// Equirectangular point-to-segment distance — accurate enough at the
// scale of an off-route check (tens of metres).
function pointSegMeters(p: LngLat, a: LngLat, b: LngLat): number {
  const latRef = toRad((a[1] + b[1]) / 2);
  const mx = (deg: number) => toRad(deg) * EARTH_R * Math.cos(latRef);
  const my = (deg: number) => toRad(deg) * EARTH_R;
  const px = mx(p[0]);
  const py = my(p[1]);
  const ax = mx(a[0]);
  const ay = my(a[1]);
  const bx = mx(b[0]);
  const by = my(b[1]);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Minimum ground distance (m) from a point to a polyline. */
export function distanceToPathMeters(p: LngLat, path: ReadonlyArray<LngLat>): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return haversineMeters(p, path[0]!);
  let min = Infinity;
  for (let i = 1; i < path.length; i++) {
    const d = pointSegMeters(p, path[i - 1]!, path[i]!);
    if (d < min) min = d;
  }
  return min;
}
