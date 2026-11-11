/**
 * Consulta Overpass con todos los tramos ciclables de un rectángulo.
 * Módulo puro: lo usan tanto el navegador como el script de build.
 */
export function buildCyclewayQuery({ south, west, north, east }) {
  const bb = `${south},${west},${north},${east}`;
  const lane = '^(lane|track|opposite_lane|opposite_track)$';
  return `[out:json][timeout:90];
(
  way["highway"="cycleway"](${bb});
  way["highway"~"^(path|footway|pedestrian)$"]["bicycle"="designated"](${bb});
  way["cycleway"~"${lane}"](${bb});
  way["cycleway:both"~"${lane}"](${bb});
  way["cycleway:left"~"${lane}"](${bb});
  way["cycleway:right"~"${lane}"](${bb});
);
out geom;`;
}

/** Se queda solo con lo que la app necesita de cada tramo. */
export function toWays(overpassJson) {
  return overpassJson.elements
    .filter((el) => el.type === 'way' && Array.isArray(el.geometry))
    .map(({ id, nodes, tags = {}, geometry }) => ({ id, nodes, tags, geometry }));
}
