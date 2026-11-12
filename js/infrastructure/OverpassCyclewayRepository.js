import { buildCyclewayQuery, toWays, toParkings } from './overpassQuery.js';

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

  async getNetwork({ forceRefresh = false } = {}) {
    if (!forceRefresh) {
      const cached = this.#cache.get();
      if (cached) return cached;
    }
    const json = await this.#client.query(buildCyclewayQuery(this.#bbox));
    const network = { ways: toWays(json), parkings: toParkings(json) };
    this.#cache.set(network);
    return network;
  }

  lastUpdated() {
    return this.#cache.savedAt();
  }
}
