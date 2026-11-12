/**
 * Cliente HTTP de Overpass con servidores de respaldo y tiempo de espera.
 * Funciona en el navegador y en Node 18+ (ambos tienen fetch).
 */
export class OverpassClient {
  #endpoints;
  #timeoutMs;
  #headers;

  /**
   * @param userAgent Solo en Node: overpass-api.de rechaza (406) el User-Agent
   *   por defecto («node»). El navegador pone el suyo y no deja cambiarlo.
   */
  constructor({ endpoints, timeoutMs = 45000, userAgent = null }) {
    this.#endpoints = endpoints;
    this.#timeoutMs = timeoutMs;
    /** @type {Record<string, string>} */
    const headers = userAgent ? { 'User-Agent': userAgent } : {};
    this.#headers = headers;
  }

  async query(overpassQl) {
    const failures = [];
    for (const endpoint of this.#endpoints) {
      try {
        return await this.#post(endpoint, overpassQl);
      } catch (error) {
        failures.push(`${new URL(endpoint).host}: ${error instanceof Error ? error.message : error}`);
      }
    }
    throw new Error(`ningún servidor Overpass respondió (${failures.join('; ')})`);
  }

  async #post(endpoint, overpassQl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.#headers,
        body: new URLSearchParams({ data: overpassQl }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`código ${response.status}`);
      return await response.json();
    } catch (error) {
      throw error instanceof Error && error.name === 'AbortError' ? new Error('tiempo de espera agotado') : error;
    } finally {
      clearTimeout(timer);
    }
  }
}
