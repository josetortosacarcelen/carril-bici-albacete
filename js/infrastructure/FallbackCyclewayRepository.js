/**
 * Prueba varios repositorios en orden y usa el primero que responda.
 * Tiene la misma interfaz que cada uno de ellos (getNetwork, lastUpdated).
 */
export class FallbackCyclewayRepository {
  #repositories;
  #active = null;

  constructor(repositories) {
    this.#repositories = repositories;
  }

  async getNetwork(options) {
    const failures = [];
    for (const repository of this.#repositories) {
      try {
        const network = await repository.getNetwork(options);
        this.#active = repository;
        return network;
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
