import { MinHeap } from './MinHeap.js';

/**
 * Dijkstra acotado: distancia por el grafo desde startId a cada nodo
 * alcanzable sin pasar de maxCost. Respeta el sentido de las aristas.
 * @param {import('./Graph.js').Graph} graph
 * @param {import('./types.js').NodeId} startId
 * @param {number} maxCost
 * @param {(edge: import('./types.js').Edge) => number} [cost] coste de cada arista (por defecto, su peso)
 * @returns {Map<import('./types.js').NodeId, number>}
 */
export function distancesWithin(graph, startId, maxCost, cost = (edge) => edge.weight) {
  const distance = new Map([[startId, 0]]);
  const done = new Set();
  const open = new MinHeap();
  open.push(0, startId);

  while (open.size > 0) {
    const { priority: current, value: id } = open.pop();
    if (done.has(id)) continue;
    done.add(id);
    for (const edge of graph.neighbors(id)) {
      const next = current + cost(edge);
      if (next <= maxCost && next < (distance.get(edge.to) ?? Infinity)) {
        distance.set(edge.to, next);
        open.push(next, edge.to);
      }
    }
  }
  return distance;
}
