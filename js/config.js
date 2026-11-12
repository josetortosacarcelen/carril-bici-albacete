// Configuración de la ciudad y de los servicios externos.
// Para usar la app en otra ciudad basta con cambiar este archivo.
export const CONFIG = Object.freeze({
  city: 'Albacete',
  center: { lat: 38.9943, lon: -1.8585 },
  zoom: 14,
  // Rectángulo que cubre el casco urbano (sur, oeste, norte, este).
  bbox: Object.freeze({ south: 38.955, west: -1.905, north: 39.025, east: -1.815 }),

  // Red generada en el despliegue (scripts/fetch-network.js). Relativa a index.html.
  staticNetworkUrl: 'data/red-carril-bici.json',

  // Servidores Overpass públicos: si uno está saturado se prueba el siguiente.
  overpassUrls: Object.freeze([
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]),
  overpassTimeoutMs: 45000,

  tiles: Object.freeze({
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Estaciones: <a href="https://citybik.es">CityBikes</a>',
    maxZoom: 19,
  }),

  nominatimSearchUrl: 'https://nominatim.openstreetmap.org/search',
  nominatimReverseUrl: 'https://nominatim.openstreetmap.org/reverse',

  // Bici pública con disponibilidad en tiempo real (null para no mostrarla).
  bikeShare: Object.freeze({
    name: 'AlbaBici',
    url: 'https://api.citybik.es/v2/networks/albabici',
    refreshMs: 2 * 60 * 1000,
  }),

  cacheKey: 'carril-bici-albacete:red:v2', // v2: { ways, parkings }
  cacheTtlMs: 7 * 24 * 60 * 60 * 1000, // una semana

  cyclingSpeedKmh: 15,
  defaultGapToleranceM: 20,
  // Acepta rodeos cortos para evitar carril pintado o compartido con peatones (ver LANE_COST).
  // En Albacete casi todo es carril separado, así que no se ofrece como opción en la interfaz.
  preferSegregated: true,
  // Distancia máxima desde una dirección hasta el carril bici más cercano.
  maxSnapDistanceM: 500,
});
