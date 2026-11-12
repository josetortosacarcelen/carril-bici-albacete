const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Distancia en metros entre dos puntos { lat, lon } (fórmula del semiverseno). */
export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

/** Coordenadas legibles («38.99430, -1.85850»), para cuando no hay dirección. */
export function formatCoords({ lat, lon }) {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
