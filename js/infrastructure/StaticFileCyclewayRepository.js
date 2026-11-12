/**
 * Lee la red generada en el despliegue (data/red-carril-bici.json).
 * Formato: { generatedAt: ISO-8601, ways: [...], parkings: [...] }
 */
export class StaticFileCyclewayRepository {
  #url;
  #generatedAt = null;

  constructor({ url }) {
    this.#url = url;
  }

  async getNetwork({ forceRefresh = false } = {}) {
    const response = await fetch(this.#url, { cache: forceRefresh ? 'reload' : 'default' });
    if (!response.ok) throw new Error(`no se encontró ${this.#url} (código ${response.status})`);
    const { generatedAt, ways, parkings = [] } = await response.json();
    if (!Array.isArray(ways) || ways.length === 0) throw new Error(`${this.#url} no contiene tramos`);
    this.#generatedAt = generatedAt ? new Date(generatedAt) : null;
    return { ways, parkings };
  }

  lastUpdated() {
    return this.#generatedAt;
  }
}
