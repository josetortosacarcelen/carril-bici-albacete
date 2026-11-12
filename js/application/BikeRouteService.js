import { EdgeKind } from './CyclewayGraphBuilder.js';
import { haversine } from '../domain/geo.js';

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

const START = 'start';
const GOAL = 'goal';
/** Tramos de carril distintos que se prueban como entrada y como salida. */
const MAX_CANDIDATES = 8;

/**
 * Calcula la ruta más corta entre dos puntos cualesquiera usando solo la red
 * de carril bici. Cada punto se engancha al punto más cercano de los tramos
 * cercanos (no solo al nodo más cercano) y se prueban varios: si el más
 * próximo es de sentido único y no lleva a ningún sitio, se usa otro.
 * El trayecto hasta el carril pesa accessWeight veces más que ir por él.
 */
export class BikeRouteService {
  #network = null;
  #pathFinder;
  #maxSnapDistanceM;
  #accessWeight;

  constructor({ pathFinder, maxSnapDistanceM, accessWeight = 2 }) {
    this.#pathFinder = pathFinder;
    this.#maxSnapDistanceM = maxSnapDistanceM;
    this.#accessWeight = accessWeight;
  }

  setNetwork(network) {
    this.#network = network;
  }

  route(origin, destination) {
    if (!this.#network) {
      throw new RouteError(RouteErrorCode.NO_NETWORK, 'La red de carriles bici aún se está cargando.');
    }
    const max = this.#maxSnapDistanceM;
    const entries = this.#candidates(origin);
    if (entries.length === 0) {
      throw new RouteError(RouteErrorCode.ORIGIN_FAR, `El origen está a más de ${max} m de cualquier carril bici.`);
    }
    const exits = this.#candidates(destination);
    if (exits.length === 0) {
      throw new RouteError(RouteErrorCode.DESTINATION_FAR, `El destino está a más de ${max} m de cualquier carril bici.`);
    }

    const graph = this.#snap(origin, destination, entries, exits);
    const path = this.#pathFinder.find(graph, START, GOAL);
    if (!path) {
      throw new RouteError(
        RouteErrorCode.NO_PATH,
        'El origen y el destino están en tramos de carril bici que no se conectan entre sí. Prueba a subir la tolerancia de huecos.',
      );
    }
    return this.#toResult(graph, path);
  }

  /** El punto más cercano de cada tramo cercano, del más próximo al más lejano. */
  #candidates(point) {
    const bestPerWay = new Map();
    for (const candidate of this.#network.segments.within(point, this.#maxSnapDistanceM)) {
      const best = bestPerWay.get(candidate.segment.wayId);
      if (!best || candidate.distance < best.distance) bestPerWay.set(candidate.segment.wayId, candidate);
    }
    return [...bestPerWay.values()].sort((x, y) => x.distance - y.distance).slice(0, MAX_CANDIDATES);
  }

  /** Grafo de la red + nodos temporales para origen, destino y sus enganches. */
  #snap(origin, destination, entries, exits) {
    const base = this.#network.graph;
    const graph = new SnappedGraph(base);
    graph.addNode(START, origin);
    graph.addNode(GOAL, destination);
    const access = (lengthM) => ({ kind: EdgeKind.ACCESS, lengthM });

    entries.forEach((entry, k) => {
      const id = `entry${k}`;
      graph.addNode(id, entry.point);
      graph.addEdge(START, id, entry.distance * this.#accessWeight, access(entry.distance));
      for (const [from, to] of directions(entry.segment)) {
        const lane = laneEdge(base, from, to);
        if (lane) graph.addEdge(id, to.id, haversine(entry.point, to), laneMeta(lane));
      }
    });

    exits.forEach((exit, k) => {
      const id = `exit${k}`;
      graph.addNode(id, exit.point);
      graph.addEdge(id, GOAL, exit.distance * this.#accessWeight, access(exit.distance));
      for (const [from, to] of directions(exit.segment)) {
        const lane = laneEdge(base, from, to);
        if (lane) graph.addEdge(from.id, id, haversine(from, exit.point), laneMeta(lane));
      }
      // Entrada y salida en el mismo segmento: se va directo si el sentido lo permite.
      entries.forEach((entry, j) => {
        if (entry.segment !== exit.segment) return;
        const { a, b } = exit.segment;
        const lane = entry.t <= exit.t ? laneEdge(base, a, b) : laneEdge(base, b, a);
        if (lane) graph.addEdge(`entry${j}`, id, haversine(entry.point, exit.point), laneMeta(lane));
      });
    });
    return graph;
  }

  #toResult(graph, { steps }) {
    const segments = [];
    const streets = [];
    let laneDistanceM = 0;
    let gapDistanceM = 0;
    let accessStartM = 0;
    let accessEndM = 0;

    for (const { from, to, edge } of steps) {
      if (edge.kind === EdgeKind.ACCESS) {
        if (from === START) accessStartM = edge.lengthM;
        else accessEndM = edge.lengthM;
        continue;
      }
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
      entry: graph.node(steps[0].to),
      exit: graph.node(steps.at(-1).from),
      laneDistanceM,
      gapDistanceM,
      accessStartM,
      accessEndM,
      networkDistanceM: laneDistanceM + gapDistanceM,
    };
  }
}

const directions = ({ a, b }) => [[a, b], [b, a]];
const laneEdge = (graph, from, to) =>
  graph.neighbors(from.id).find((e) => e.to === to.id && e.kind === EdgeKind.LANE);
const laneMeta = (edge) => ({ kind: EdgeKind.LANE, wayId: edge.wayId, name: edge.name });

/**
 * Vista del grafo de la red con nodos y aristas extra, sin modificarlo:
 * la red se comparte entre rutas y no debe ensuciarse.
 */
class SnappedGraph {
  #base;
  #nodes = new Map();
  #extra = new Map();

  constructor(base) {
    this.#base = base;
  }

  addNode(id, { lat, lon }) {
    this.#nodes.set(id, { id, lat, lon });
  }

  addEdge(from, to, weight, meta) {
    if (!this.#extra.has(from)) this.#extra.set(from, []);
    this.#extra.get(from).push({ to, weight, ...meta });
  }

  node(id) {
    return this.#nodes.get(id) ?? this.#base.node(id);
  }

  neighbors(id) {
    const extra = this.#extra.get(id);
    const base = this.#base.neighbors(id);
    return extra ? [...base, ...extra] : base;
  }
}
