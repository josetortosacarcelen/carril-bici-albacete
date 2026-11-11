import { MinHeap } from './MinHeap.js';
import { haversine } from './geo.js';

/**
 * Camino más corto con A*. La heurística (distancia en línea recta) es
 * admisible porque ningún tramo puede ser más corto que la línea recta,
 * así que el resultado es exactamente el mismo que daría Dijkstra.
 */
export class AStarPathFinder {
  /**
   * @returns {{ steps: Array<{from, to, edge}>, distance: number } | null}
   */
  find(graph, startId, goalId) {
    const goal = graph.node(goalId);
    if (!graph.node(startId) || !goal) return null;

    const heuristic = (id) => haversine(graph.node(id), goal);
    const cost = new Map([[startId, 0]]);
    const cameFrom = new Map();
    const closed = new Set();
    const open = new MinHeap();
    open.push(heuristic(startId), startId);

    while (open.size > 0) {
      const { value: current } = open.pop();
      if (closed.has(current)) continue;
      if (current === goalId) {
        return { steps: this.#reconstruct(cameFrom, goalId), distance: cost.get(goalId) };
      }
      closed.add(current);

      const currentCost = cost.get(current);
      for (const edge of graph.neighbors(current)) {
        if (closed.has(edge.to)) continue;
        const tentative = currentCost + edge.weight;
        if (tentative < (cost.get(edge.to) ?? Infinity)) {
          cost.set(edge.to, tentative);
          cameFrom.set(edge.to, { from: current, edge });
          open.push(tentative + heuristic(edge.to), edge.to);
        }
      }
    }
    return null;
  }

  #reconstruct(cameFrom, goalId) {
    const steps = [];
    let id = goalId;
    while (cameFrom.has(id)) {
      const { from, edge } = cameFrom.get(id);
      steps.push({ from, to: id, edge });
      id = from;
    }
    return steps.reverse();
  }
}
