import { Graph } from '../domain/Graph.js';
import { DisjointSet } from '../domain/DisjointSet.js';
import { SpatialIndex } from '../domain/SpatialIndex.js';
import { haversine } from '../domain/geo.js';

export const EdgeKind = Object.freeze({ LANE: 'lane', GAP: 'gap' });

/**
 * Sentido de circulación para bicis de un tramo OSM:
 *  1 = en el sentido del dibujo, -1 = en sentido contrario, 0 = doble sentido.
 */
export function bikeDirection(tags = {}) {
  const bikeOneway = tags['oneway:bicycle'];
  if (bikeOneway === 'no') return 0;
  if (bikeOneway === 'yes') return 1;
  if (bikeOneway === '-1') return -1;

  // Carril a contramano en una calle de sentido único: la bici va en ambos.
  if (String(tags.cycleway ?? '').startsWith('opposite')) return 0;

  if (tags.oneway === 'yes') return 1;
  if (tags.oneway === '-1') return -1;
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
    let laneLengthM = 0;
    for (const way of ways) laneLengthM += this.#addWay(graph, way);

    const index = this.#buildIndex(graph);
    const components = this.#connectedComponents(graph);
    const gaps = gapToleranceM > 0
      ? this.#bridgeGaps(graph, index, components, gapToleranceM)
      : [];

    return {
      graph,
      index,
      gaps,
      stats: { laneLengthM, segments: ways.length, networks: components.count },
    };
  }

  #addWay(graph, way) {
    const points = (way.nodes ?? [])
      .map((id, k) => ({ id, point: way.geometry?.[k] }))
      .filter(({ point }) => point && Number.isFinite(point.lat));
    if (points.length < 2) return 0;

    const direction = bikeDirection(way.tags);
    const meta = { kind: EdgeKind.LANE, wayId: way.id, name: way.tags?.name ?? null };
    let length = 0;

    for (const { id, point } of points) graph.addNode(id, point.lat, point.lon);
    for (let k = 1; k < points.length; k += 1) {
      const a = points[k - 1];
      const b = points[k];
      const distance = haversine(a.point, b.point);
      length += distance;
      if (direction >= 0) graph.addEdge(a.id, b.id, distance, meta);
      if (direction <= 0) graph.addEdge(b.id, a.id, distance, meta);
    }
    return length;
  }

  #buildIndex(graph) {
    const nodes = [...graph.nodes()];
    const referenceLat = nodes.length
      ? nodes.reduce((sum, n) => sum + n.lat, 0) / nodes.length
      : 0;
    const index = new SpatialIndex({ cellSizeM: 50, referenceLat });
    for (const node of nodes) index.insert(node);
    return index;
  }

  #connectedComponents(graph) {
    const set = new DisjointSet();
    for (const node of graph.nodes()) set.add(node.id);
    for (const node of graph.nodes()) {
      for (const edge of graph.neighbors(node.id)) set.union(node.id, edge.to);
    }
    return set;
  }

  /** Une redes separadas por el hueco más corto posible (estilo Kruskal). */
  #bridgeGaps(graph, index, components, toleranceM) {
    const candidates = [];
    for (const node of graph.nodes()) {
      for (const { item, distance } of index.within(node, toleranceM)) {
        if (item.id <= node.id) continue;
        if (components.find(item.id) !== components.find(node.id)) {
          candidates.push({ a: node, b: item, distance });
        }
      }
    }
    candidates.sort((x, y) => x.distance - y.distance);

    const gaps = [];
    for (const { a, b, distance } of candidates) {
      if (!components.union(a.id, b.id)) continue;
      graph.addTwoWayEdge(a.id, b.id, distance, { kind: EdgeKind.GAP, name: null });
      gaps.push([a, b]);
    }
    return gaps;
  }
}
