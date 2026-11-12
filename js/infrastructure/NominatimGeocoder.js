import { RateLimiter } from './RateLimiter.js';

/**
 * Búsqueda de direcciones con Nominatim (OpenStreetMap), limitada a la ciudad.
 * La política de Nominatim no permite autocompletar mientras se escribe,
 * así que la app solo busca cuando el usuario lo pide, y como máximo
 * una petición por segundo (también al pulsar o arrastrar en el mapa).
 */
export class NominatimGeocoder {
  #searchUrl;
  #reverseUrl;
  #city;
  #bbox;
  #limiter;

  constructor({ searchUrl, reverseUrl, city, bbox, minIntervalMs = 1100 }) {
    this.#limiter = new RateLimiter(minIntervalMs);
    this.#searchUrl = searchUrl;
    this.#reverseUrl = reverseUrl;
    this.#city = city;
    this.#bbox = bbox;
  }

  async search(text) {
    const { west, north, east, south } = this.#bbox;
    const params = new URLSearchParams({
      q: `${text}, ${this.#city}`,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'es',
      'accept-language': 'es',
      viewbox: `${west},${north},${east},${south}`,
      bounded: '1',
    });
    const data = await this.#get(`${this.#searchUrl}?${params}`);
    return data.map((place) => ({
      label: formatLabel(place),
      lat: Number(place.lat),
      lon: Number(place.lon),
    }));
  }

  /**
   * @param key Peticiones con la misma clave se sustituyen mientras esperan turno
   *   (rechazan con SupersededError): al arrastrar solo cuenta la última.
   */
  async reverse({ lat, lon }, { key = null } = {}) {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'jsonv2',
      addressdetails: '1',
      zoom: '18',
      'accept-language': 'es',
    });
    return formatLabel(await this.#get(`${this.#reverseUrl}?${params}`, key));
  }

  #get(url, key = null) {
    return this.#limiter.schedule(async () => {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Nominatim respondió con el código ${response.status}`);
      return response.json();
    }, { key });
  }
}

export function formatLabel(place) {
  const a = place?.address ?? {};
  const street = a.road ?? a.pedestrian ?? a.cycleway ?? a.footway ?? a.square;
  if (street) {
    const number = a.house_number ? ` ${a.house_number}` : '';
    const area = a.suburb ?? a.neighbourhood ?? a.quarter;
    return area ? `${street}${number} (${area})` : `${street}${number}`;
  }
  return (place?.display_name ?? '').split(',').slice(0, 2).join(',').trim();
}
