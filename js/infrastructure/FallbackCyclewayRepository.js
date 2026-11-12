/** @typedef {import('../domain/types.js').NetworkRepository} NetworkRepository */

/**
 * Prueba varios repositorios en orden y usa el primero que responda.
 * Tiene la misma interfaz que cada uno de ellos (getNetwork, lastUpdated).
 */
/** @implements {NetworkRepository} */
export class FallbackCyclewayRepository {
  /** @type {NetworkRepository[]} */
  #repositories;
  /** @type {NetworkRepository | null} */
  #active = null;

  /** @param {NetworkRepository[]} repositories en orden de preferencia */
  constructor(repositories) {
    this.#repositories = repositories;
  }

  /** @param {{ forceRefresh?: boolean }} [options] */
  async getNetwork(options) {
    const failures = [];
    for (const repository of this.#repositories) {
      try {
        const network = await repository.getNetwork(options);
        this.#active = repository;
        return network;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
    throw new Error(failures.join(' · '));
  }

  lastUpdated() {
    return this.#active?.lastUpdated() ?? null;
  }
}
