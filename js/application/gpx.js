/**
 * Ruta en formato GPX 1.1 (lo abren Komoot, Strava, Garmin, OsmAnd…):
 * un track desde el origen, por el carril, hasta el destino.
 */
export function toGpx({ origin, destination, result, name, creator = 'Carril Bici', time = new Date() }) {
  const points = [origin, result.entry];
  for (const segment of result.segments) points.push(...segment.points);
  points.push(result.exit, destination);

  const trkpts = withoutRepeats(points)
    .map((p) => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${escapeXml(creator)}" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${time.toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <type>cycling</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

/** Nombre de archivo con la fecha y hora locales: ruta-carril-bici-20261112-2158.gpx */
export function gpxFilename(date = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}`;
  return `ruta-carril-bici-${day}-${two(date.getHours())}${two(date.getMinutes())}.gpx`;
}

function withoutRepeats(points) {
  return points.filter((p, k) => k === 0 || p.lat !== points[k - 1].lat || p.lon !== points[k - 1].lon);
}

function escapeXml(text) {
  return String(text).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
}
