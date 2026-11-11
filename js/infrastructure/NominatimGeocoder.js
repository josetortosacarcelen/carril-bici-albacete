/**
 * Búsqueda de direcciones con Nominatim (OpenStreetMap), limitada a la ciudad.
 * La política de Nominatim no permite autocompletar mientras se escribe,
 * así que la app solo busca cuando el usuario lo pide.
 */
export class NominatimGeocoder {
  #searchUrl;
  #reverseUrl;
  #city;
  #bbox;

  constructor({ searchUrl, reverseUrl, city, bbox }) {
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

  async reverse({ lat, lon }) {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'jsonv2',
      addressdetails: '1',
      zoom: '18',
      'accept-language': 'es',
    });
    return formatLabel(await this.#get(`${this.#reverseUrl}?${params}`));
  }

  async #get(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Nominatim respondió con el código ${response.status}`);
    return response.json();
  }
}

function formatLabel(place) {
  const a = place?.address ?? {};
  const street = a.road ?? a.pedestrian ?? a.cycleway ?? a.footway ?? a.square;
  if (street) {
    const number = a.house_number ? ` ${a.house_number}` : '';
    const area = a.suburb ?? a.neighbourhood ?? a.quarter;
    return area ? `${street}${number} (${area})` : `${street}${number}`;
  }
  return (place?.display_name ?? '').split(',').slice(0, 2).join(',').trim();
}
