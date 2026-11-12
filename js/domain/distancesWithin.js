import { MinHeap } from './MinHeap.js';

/**
 * Dijkstra acotado: distancia por el grafo desde startId a cada nodo
 * alcanzable sin pasar de maxCost. Respeta el sentido de las aristas.
 * @returns {Map<id, number>}
 */
export function distancesWithin(graph, startId, maxCost) {
  const distance = new Map([[startId, 0]]);
  const done = new Set();
  const open = new MinHeap();
  open.push(0, startId);

  while (open.size > 0) {
    const { priority: current, value: id } = open.pop();
    if (done.has(id)) continue;
    done.add(id);
    for (const edge of graph.neighbors(id)) {
      const next = current + edge.weight;
      if (next <= maxCost && next < (distance.get(edge.to) ?? Infinity)) {
        distance.set(edge.to, next);
        open.push(next, edge.to);
      }
    }
  }
  return distance;
}
