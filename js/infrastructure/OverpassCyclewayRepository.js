import { buildCyclewayQuery, toWays } from './overpassQuery.js';

/**
 * Descarga la red en vivo desde Overpass y la guarda en caché local.
 * En producción es el plan B: el plan A es el archivo estático.
 */
export class OverpassCyclewayRepository {
  #client;
  #bbox;
  #cache;

  constructor({ client, bbox, cache }) {
    this.#client = client;
    this.#bbox = bbox;
    this.#cache = cache;
  }

  async getWays({ forceRefresh = false } = {}) {
    if (!forceRefresh) {
      const cached = this.#cache.get();
      if (cached) return cached;
    }
    const ways = toWays(await this.#client.query(buildCyclewayQuery(this.#bbox)));
    this.#cache.set(ways);
    return ways;
  }

  lastUpdated() {
    return this.#cache.savedAt();
  }
}
