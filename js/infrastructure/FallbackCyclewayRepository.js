/**
 * Prueba varios repositorios en orden y usa el primero que responda.
 * Tiene la misma interfaz que cada uno de ellos (getWays, lastUpdated).
 */
export class FallbackCyclewayRepository {
  #repositories;
  #active = null;

  constructor(repositories) {
    this.#repositories = repositories;
  }

  async getWays(options) {
    const failures = [];
    for (const repository of this.#repositories) {
      try {
        const ways = await repository.getWays(options);
        this.#active = repository;
        return ways;
      } catch (error) {
        failures.push(error.message);
      }
    }
    throw new Error(failures.join(' · '));
  }

  lastUpdated() {
    return this.#active?.lastUpdated() ?? null;
  }
}
