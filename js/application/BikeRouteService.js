import { EdgeKind } from './CyclewayGraphBuilder.js';

export const RouteErrorCode = Object.freeze({
  NO_NETWORK: 'NO_NETWORK',
  ORIGIN_FAR: 'ORIGIN_FAR',
  DESTINATION_FAR: 'DESTINATION_FAR',
  NO_PATH: 'NO_PATH',
});

export class RouteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RouteError';
    this.code = code;
  }
}

/**
 * Calcula la ruta más corta entre dos puntos cualesquiera usando solo la red
 * de carril bici. Cada punto se engancha al nodo de carril más cercano.
 */
export class BikeRouteService {
  #network = null;
  #pathFinder;
  #maxSnapDistanceM;

  constructor({ pathFinder, maxSnapDistanceM }) {
    this.#pathFinder = pathFinder;
    this.#maxSnapDistanceM = maxSnapDistanceM;
  }

  setNetwork(network) {
    this.#network = network;
  }

  route(origin, destination) {
    if (!this.#network) {
      throw new RouteError(RouteErrorCode.NO_NETWORK, 'La red de carriles bici aún se está cargando.');
    }
    const { graph, index } = this.#network;
    const max = this.#maxSnapDistanceM;

    const entry = index.nearest(origin, max);
    if (!entry) {
      throw new RouteError(RouteErrorCode.ORIGIN_FAR, `El origen está a más de ${max} m de cualquier carril bici.`);
    }
    const exit = index.nearest(destination, max);
    if (!exit) {
      throw new RouteError(RouteErrorCode.DESTINATION_FAR, `El destino está a más de ${max} m de cualquier carril bici.`);
    }

    const path = this.#pathFinder.find(graph, entry.item.id, exit.item.id);
    if (!path) {
      throw new RouteError(
        RouteErrorCode.NO_PATH,
        'El origen y el destino están en tramos de carril bici que no se conectan entre sí. Prueba a subir la tolerancia de huecos.',
      );
    }
    return this.#toResult(graph, path, entry, exit);
  }

  #toResult(graph, { steps }, entry, exit) {
    const segments = [];
    const streets = [];
    let laneDistanceM = 0;
    let gapDistanceM = 0;

    for (const { from, to, edge } of steps) {
      if (edge.kind === EdgeKind.GAP) gapDistanceM += edge.weight;
      else laneDistanceM += edge.weight;

      const last = segments.at(-1);
      if (last?.kind === edge.kind) last.points.push(graph.node(to));
      else segments.push({ kind: edge.kind, points: [graph.node(from), graph.node(to)] });

      if (edge.name && streets.at(-1) !== edge.name) streets.push(edge.name);
    }

    return {
      segments,
      streets: [...new Set(streets)],
      entry: entry.item,
      exit: exit.item,
      laneDistanceM,
      gapDistanceM,
      accessStartM: entry.distance,
      accessEndM: exit.distance,
      networkDistanceM: laneDistanceM + gapDistanceM,
    };
  }
}
