import { haversine } from './geo.js';

const METERS_PER_DEGREE_LAT = 111320;

/**
 * Proyecta p sobre el segmento a–b. Devuelve la fracción t (0 = a, 1 = b) y el
 * punto proyectado. A escala de calle, tratar lat/lon como plano (corrigiendo
 * la longitud por el coseno de la latitud) es más que preciso.
 */
export function projectOnSegment(p, a, b) {
  const kx = Math.cos((p.lat * Math.PI) / 180);
  const ax = (a.lon - p.lon) * kx;
  const ay = a.lat - p.lat;
  const dx = (b.lon - a.lon) * kx;
  const dy = b.lat - a.lat;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / length2));
  return { t, point: { lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon) } };
}

/**
 * Índice espacial en rejilla para segmentos { a, b, ... }. Cada segmento se
 * apunta en todas las celdas que atraviesa, así que un tramo largo se
 * encuentra aunque sus extremos queden lejos del punto buscado.
 */
export class SegmentIndex {
  #cells = new Map();
  #cellSizeM;
  #dLat;
  #dLon;

  constructor({ cellSizeM = 50, referenceLat }) {
    this.#cellSizeM = cellSizeM;
    this.#dLat = cellSizeM / METERS_PER_DEGREE_LAT;
    this.#dLon = cellSizeM / (METERS_PER_DEGREE_LAT * Math.cos((referenceLat * Math.PI) / 180));
  }

  insert(segment) {
    const { a, b } = segment;
    // Muestras cada media celda: ningún trozo del segmento se queda sin celda cercana.
    const steps = Math.max(1, Math.ceil(haversine(a, b) / (this.#cellSizeM / 2)));
    const keys = new Set();
    for (let k = 0; k <= steps; k += 1) {
      const t = k / steps;
      keys.add(this.#keyOf({ lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon) }));
    }
    for (const key of keys) {
      if (!this.#cells.has(key)) this.#cells.set(key, []);
      this.#cells.get(key).push(segment);
    }
  }

  /** Segmentos a menos de radiusM metros, con su punto más cercano a `point`. */
  within(point, radiusM) {
    const reach = Math.ceil(radiusM / this.#cellSizeM) + 1;
    const ci = Math.floor(point.lat / this.#dLat);
    const cj = Math.floor(point.lon / this.#dLon);
    const seen = new Set();
    const found = [];
    for (let i = ci - reach; i <= ci + reach; i += 1) {
      for (let j = cj - reach; j <= cj + reach; j += 1) {
        for (const segment of this.#cells.get(`${i}:${j}`) ?? []) {
          if (seen.has(segment)) continue;
          seen.add(segment);
          const { t, point: closest } = projectOnSegment(point, segment.a, segment.b);
          const distance = haversine(point, closest);
          if (distance <= radiusM) found.push({ segment, t, point: closest, distance });
        }
      }
    }
    return found;
  }

  #keyOf(p) {
    return `${Math.floor(p.lat / this.#dLat)}:${Math.floor(p.lon / this.#dLon)}`;
  }
}
