/**
 * Grafo dirigido y ponderado. Los nodos son puntos geográficos y las aristas
 * llevan metadatos libres (tipo de tramo, nombre de la calle…).
 */
export class Graph {
  #nodes = new Map();
  #adjacency = new Map();

  addNode(id, lat, lon) {
    if (!this.#nodes.has(id)) {
      this.#nodes.set(id, { id, lat, lon });
      this.#adjacency.set(id, []);
    }
    return this.#nodes.get(id);
  }

  addEdge(from, to, weight, meta = {}) {
    if (!this.#nodes.has(from) || !this.#nodes.has(to)) {
      throw new Error(`Arista entre nodos inexistentes: ${from} → ${to}`);
    }
    this.#adjacency.get(from).push({ to, weight, ...meta });
  }

  addTwoWayEdge(a, b, weight, meta = {}) {
    this.addEdge(a, b, weight, meta);
    this.addEdge(b, a, weight, meta);
  }

  node(id) {
    return this.#nodes.get(id);
  }

  neighbors(id) {
    return this.#adjacency.get(id) ?? [];
  }

  nodes() {
    return this.#nodes.values();
  }

  get size() {
    return this.#nodes.size;
  }
}
