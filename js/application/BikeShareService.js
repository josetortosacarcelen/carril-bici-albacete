import { nearestStation } from './nearestStation.js';

/**
 * Bici pública: mantiene las estaciones al día (carga y refresco periódico)
 * y propone dónde coger y dejar la bici para una ruta.
 * Si el servicio no responde se conservan las últimas estaciones conocidas.
 */
export class BikeShareService {
  #repository;
  #refreshMs;
  #stations = [];
  #onChange = null;

  constructor({ repository, refreshMs }) {
    this.#repository = repository;
    this.#refreshMs = refreshMs;
  }

  /** Carga ya y después cada refreshMs; avisa con onChange(stations) tras cada carga correcta. */
  start(onChange) {
    this.#onChange = onChange;
    this.refresh();
    setInterval(() => this.refresh(), this.#refreshMs);
  }

  /** @returns {Promise<boolean>} true si se han podido actualizar las estaciones. */
  async refresh() {
    try {
      this.#stations = await this.#repository.getStations();
    } catch {
      return false;
    }
    this.#onChange?.(this.#stations);
    return true;
  }

  get stations() {
    return this.#stations;
  }

  /** Estación con bicis más cercana al origen y con anclajes libres más cercana al destino. */
  suggest(origin, destination) {
    if (this.#stations.length === 0) return null;
    return {
      pickup: nearestStation(origin, this.#stations, 'bikes'),
      dropoff: nearestStation(destination, this.#stations, 'slots'),
    };
  }
}
