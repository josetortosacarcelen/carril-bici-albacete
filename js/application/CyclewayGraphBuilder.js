import { Graph } from '../domain/Graph.js';
import { DisjointSet } from '../domain/DisjointSet.js';
import { SpatialIndex } from '../domain/SpatialIndex.js';
import { SegmentIndex } from '../domain/SegmentIndex.js';
import { distancesWithin } from '../domain/distancesWithin.js';
import { haversine } from '../domain/geo.js';

export const EdgeKind = Object.freeze({ LANE: 'lane', GAP: 'gap', ACCESS: 'access' });

/** Un hueco solo se une si rodear por el carril es más del doble de largo que saltarlo. */
export const DETOUR_FACTOR = 2;

const YES = new Set(['yes', '1', 'true']);

/**
 * Sentido de circulación para bicis de un tramo OSM:
 *  1 = en el sentido del dibujo, -1 = en sentido contrario, 0 = doble sentido.
 */
export function bikeDirection(tags = {}) {
  const bikeOneway = tags['oneway:bicycle'];
  if (bikeOneway === 'no') return 0;
  if (YES.has(bikeOneway)) return 1;
  if (bikeOneway === '-1') return -1;

  // Carril a contramano en una calle de sentido único: la bici va en ambos.
  if (String(tags.cycleway ?? '').startsWith('opposite')) return 0;

  if (YES.has(tags.oneway)) return 1;
  if (tags.oneway === '-1') return -1;
  if (tags.oneway === 'no') return 0;

  // En OSM las rotondas son de sentido único aunque no lleven oneway.
  if (tags.junction === 'roundabout' || tags.junction === 'circular') return 1;
  return 0;
}

/**
 * Convierte los tramos de OSM en un grafo navegable. Dos tramos quedan
 * conectados cuando comparten un nodo. Opcionalmente une huecos cortos
 * entre tramos que, en la práctica, son un cruce o un paso de cebra.
 */
export class CyclewayGraphBuilder {
  build(ways, { gapToleranceM = 0 } = {}) {
    const graph = new Graph();
    const wayOfNode = new Map();
    const segments = [];
    let laneLengthM = 0;
    for (const way of ways) laneLengthM += this.#addWay(graph, way, wayOfNode, segments);

    const nodes = [...graph.nodes()];
    const referenceLat = nodes.length ? nodes.reduce((sum, n) => sum + n.lat, 0) / nodes.length : 0;
    const nodeIndex = new SpatialIndex({ cellSizeM: 50, referenceLat });
    for (const node of nodes) nodeIndex.insert(node);
    const segmentIndex = new SegmentIndex({ cellSizeM: 50, referenceLat });
    for (const segment of segments) segmentIndex.insert(segment);

    const networks = this.#countNetworks(graph);
    const gaps = gapToleranceM > 0
      ? this.#bridgeGaps(graph, nodeIndex, wayOfNode, gapToleranceM)
      : [];

    return {
      graph,
      segments: segmentIndex,
      gaps,
      stats: { laneLengthM, segments: ways.length, networks },
    };
  }

  #addWay(graph, way, wayOfNode, segments) {
    const points = (way.nodes ?? [])
      .map((id, k) => ({ id, point: way.geometry?.[k] }))
      .filter(({ point }) => point && Number.isFinite(point.lat));
    if (points.length < 2) return 0;

    const direction = bikeDirection(way.tags);
    const meta = { kind: EdgeKind.LANE, wayId: way.id, name: way.tags?.name ?? null };
    let length = 0;

    const nodes = points.map(({ id, point }) => {
      if (!wayOfNode.has(id)) wayOfNode.set(id, way.id);
      return graph.addNode(id, point.lat, point.lon);
    });
    for (let k = 1; k < nodes.length; k += 1) {
      const a = nodes[k - 1];
      const b = nodes[k];
      const distance = haversine(a, b);
      length += distance;
      if (direction >= 0) graph.addEdge(a.id, b.id, distance, meta);
      if (direction <= 0) graph.addEdge(b.id, a.id, distance, meta);
      segments.push({ a, b, wayId: way.id });
    }
    return length;
  }

  /** Número de redes de carril sin conectar entre sí (sin contar huecos). */
  #countNetworks(graph) {
    const set = new DisjointSet();
    for (const node of graph.nodes()) set.add(node.id);
    for (const node of graph.nodes()) {
      for (const edge of graph.neighbors(node.id)) set.union(node.id, edge.to);
    }
    return set.count;
  }

  /**
   * Une cada nodo con el nodo más cercano de cada tramo vecino (a menos de
   * toleranceM), pero solo si llegar hasta él por el carril obliga a rodear:
   * más de DETOUR_FACTOR veces el salto. Así se unen todos los cruces útiles,
   * no solo uno por red, y no se recortan esquinas que ya están conectadas.
   * Las aristas de hueco son dirigidas: cada sentido se justifica por separado.
   */
  #bridgeGaps(graph, nodeIndex, wayOfNode, toleranceM) {
    const pending = [];
    for (const node of graph.nodes()) {
      const nearestPerWay = new Map();
      for (const candidate of nodeIndex.within(node, toleranceM)) {
        if (candidate.item.id === node.id) continue;
        const wayId = wayOfNode.get(candidate.item.id);
        const best = nearestPerWay.get(wayId);
        if (!best || candidate.distance < best.distance) nearestPerWay.set(wayId, candidate);
      }
      if (nearestPerWay.size === 0) continue;

      const byLane = distancesWithin(graph, node.id, toleranceM * DETOUR_FACTOR);
      for (const { item, distance } of nearestPerWay.values()) {
        if ((byLane.get(item.id) ?? Infinity) > distance * DETOUR_FACTOR) {
          pending.push({ a: node, b: item, distance });
        }
      }
    }

    // Se añaden al final para que ningún hueco influya en la decisión de otro.
    const gaps = new Map();
    for (const { a, b, distance } of pending) {
      graph.addEdge(a.id, b.id, distance, { kind: EdgeKind.GAP, name: null });
      const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
      if (!gaps.has(key)) gaps.set(key, [a, b]);
    }
    return [...gaps.values()];
  }
}
