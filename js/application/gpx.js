/**
 * Ruta en formato GPX 1.1 (lo abren Komoot, Strava, Garmin, OsmAnd…):
 * un track desde el origen, por el carril, hasta el destino.
 */
export function toGpx({ origin, destination, result, name, time = new Date() }) {
  const points = [origin, result.entry];
  for (const segment of result.segments) points.push(...segment.points);
  points.push(result.exit, destination);

  const trkpts = withoutRepeats(points)
    .map((p) => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Carril Bici Albacete" xmlns="http://www.topografix.com/GPX/1/1">
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

function withoutRepeats(points) {
  return points.filter((p, k) => k === 0 || p.lat !== points[k - 1].lat || p.lon !== points[k - 1].lon);
}

function escapeXml(text) {
  return String(text).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
}
