/**
 * Estaciones de bici pública con disponibilidad en tiempo real, desde la API
 * abierta de CityBikes (https://api.citybik.es, sin clave, con CORS).
 */
export class CityBikesStationRepository {
  #url;

  constructor({ url }) {
    this.#url = url;
  }

  async getStations() {
    const response = await fetch(this.#url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`CityBikes respondió con el código ${response.status}`);
    return toStations(await response.json());
  }
}

/** Se queda con lo que la app necesita de cada estación. */
export function toStations(json) {
  return (json?.network?.stations ?? [])
    .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
    .map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.latitude,
      lon: s.longitude,
      freeBikes: s.free_bikes ?? 0,
      ebikes: s.extra?.ebikes ?? 0,
      emptySlots: s.empty_slots ?? 0,
      online: s.extra?.online !== false,
    }));
}
