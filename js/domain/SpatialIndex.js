import { haversine } from './geo.js';

const METERS_PER_DEGREE_LAT = 111320;

/**
 * Índice espacial en rejilla para buscar puntos cercanos sin recorrer
 * todos los nodos. A escala de ciudad es más que suficiente.
 */
export class SpatialIndex {
  #cells = new Map();
  #cellSizeM;
  #dLat;
  #dLon;

  constructor({ cellSizeM = 100, referenceLat }) {
    this.#cellSizeM = cellSizeM;
    this.#dLat = cellSizeM / METERS_PER_DEGREE_LAT;
    this.#dLon = cellSizeM / (METERS_PER_DEGREE_LAT * Math.cos((referenceLat * Math.PI) / 180));
  }

  insert(item) {
    const key = this.#key(...this.#cellOf(item));
    if (!this.#cells.has(key)) this.#cells.set(key, []);
    this.#cells.get(key).push(item);
  }

  /** Elementos a menos de radiusM metros, con su distancia. */
  within(point, radiusM) {
    const reach = Math.ceil(radiusM / this.#cellSizeM);
    const [ci, cj] = this.#cellOf(point);
    const found = [];
    for (let i = ci - reach; i <= ci + reach; i += 1) {
      for (let j = cj - reach; j <= cj + reach; j += 1) {
        for (const item of this.#cells.get(this.#key(i, j)) ?? []) {
          const distance = haversine(point, item);
          if (distance <= radiusM) found.push({ item, distance });
        }
      }
    }
    return found;
  }

  /** Elemento más cercano dentro de maxDistanceM, o null. */
  nearest(point, maxDistanceM) {
    let best = null;
    for (const candidate of this.within(point, maxDistanceM)) {
      if (!best || candidate.distance < best.distance) best = candidate;
    }
    return best;
  }

  #cellOf(point) {
    return [Math.floor(point.lat / this.#dLat), Math.floor(point.lon / this.#dLon)];
  }

  #key(i, j) {
    return `${i}:${j}`;
  }
}
