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

/** Tipo de tramo: separado del tráfico, pintado en la calzada o compartido con peatones. */
export const LaneKind = Object.freeze({ SEGREGATED: 'segregated', PAINTED: 'painted', SHARED: 'shared' });

/**
 * Cuánto «cuesta» cada metro según el tipo de tramo cuando se prefiere el
 * carril separado: la ruta acepta hasta un 30 % más de recorrido por evitar
 * carril pintado en la calzada. Las distancias mostradas siguen siendo reales.
 */
export const LANE_COST = Object.freeze({ segregated: 1, shared: 1.15, painted: 1.3 });

export function laneKind(tags = {}) {
  // segregated=no: la bici va mezclada con los peatones (p. ej. «cycleway» + «foot=designated»).
  if (tags.highway === 'cycleway') return tags.segregated === 'no' ? LaneKind.SHARED : LaneKind.SEGREGATED;
  if (['path', 'footway', 'pedestrian'].includes(tags.highway)) {
    return tags.segregated === 'yes' ? LaneKind.SEGREGATED : LaneKind.SHARED;
  }
  // Calle con carril: «track» va separado de los coches; «lane» es pintura.
  const sides = ['cycleway', 'cycleway:both', 'cycleway:left', 'cycleway:right'].map((k) => String(tags[k] ?? ''));
  return sides.some((v) => v.endsWith('track')) ? LaneKind.SEGREGATED : LaneKind.PAINTED;
}

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
  /**
   * @param preferSegregated Si es true, el peso de cada tramo es su longitud × LANE_COST.
   */
  build(ways, { gapToleranceM = 0, preferSegregated = false } = {}) {
    const graph = new Graph();
    const wayOfNode = new Map();
    const segments = [];
    let laneLengthM = 0;
    for (const way of ways) laneLengthM += this.#addWay(graph, way, wayOfNode, segments, preferSegregated);

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

  #addWay(graph, way, wayOfNode, segments, preferSegregated) {
    const points = (way.nodes ?? [])
      .map((id, k) => ({ id, point: way.geometry?.[k] }))
      .filter(({ point }) => point && Number.isFinite(point.lat));
    if (points.length < 2) return 0;

    const direction = bikeDirection(way.tags);
    const kind = laneKind(way.tags);
    const factor = preferSegregated ? LANE_COST[kind] : 1;
    const meta = { kind: EdgeKind.LANE, wayId: way.id, name: way.tags?.name ?? null, laneKind: kind, factor };
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
      const edge = { ...meta, lengthM: distance };
      if (direction >= 0) graph.addEdge(a.id, b.id, distance * factor, edge);
      if (direction <= 0) graph.addEdge(b.id, a.id, distance * factor, edge);
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

      const byLane = distancesWithin(graph, node.id, toleranceM * DETOUR_FACTOR, (e) => e.lengthM);
      for (const { item, distance } of nearestPerWay.values()) {
        if ((byLane.get(item.id) ?? Infinity) > distance * DETOUR_FACTOR) {
          pending.push({ a: node, b: item, distance });
        }
      }
    }

    // Se añaden al final para que ningún hueco influya en la decisión de otro.
    const gaps = new Map();
    for (const { a, b, distance } of pending) {
      graph.addEdge(a.id, b.id, distance, { kind: EdgeKind.GAP, name: null, lengthM: distance });
      const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
      if (!gaps.has(key)) gaps.set(key, [a, b]);
    }
    return [...gaps.values()];
  }
}
