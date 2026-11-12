/**
 * Consulta Overpass con todos los tramos ciclables y los aparcabicis de un
 * rectángulo. Módulo puro: lo usan tanto el navegador como el script de build.
 */
export function buildCyclewayQuery({ south, west, north, east }) {
  const bb = `${south},${west},${north},${east}`;
  const lane = '^(lane|track|opposite_lane|opposite_track)$';
  return `[out:json][timeout:120];
(
  way["highway"="cycleway"](${bb});
  way["highway"~"^(path|footway|pedestrian)$"]["bicycle"="designated"](${bb});
  way["cycleway"~"${lane}"](${bb});
  way["cycleway:both"~"${lane}"](${bb});
  way["cycleway:left"~"${lane}"](${bb});
  way["cycleway:right"~"${lane}"](${bb});
)->.lanes;
nwr["amenity"="bicycle_parking"](${bb})->.parkings;
.lanes out geom;
.parkings out center tags;`;
}

const isParking = (el) => el.tags?.amenity === 'bicycle_parking';

/** Se queda solo con lo que la app necesita de cada tramo. */
export function toWays(overpassJson) {
  return overpassJson.elements
    .filter((el) => el.type === 'way' && Array.isArray(el.geometry) && !isParking(el))
    .map(({ id, nodes, tags = {}, geometry }) => ({ id, nodes, tags, geometry }));
}

/** Aparcabicis: un punto por elemento (los que son áreas, por su centro). */
export function toParkings(overpassJson) {
  return overpassJson.elements
    .filter(isParking)
    .map((el) => ({
      id: `${el.type}/${el.id}`,
      lat: el.lat ?? el.center?.lat,
      lon: el.lon ?? el.center?.lon,
      capacity: Number.parseInt(el.tags.capacity, 10) || null,
      covered: el.tags.covered === 'yes',
      name: el.tags.name ?? null,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}
