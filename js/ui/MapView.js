/* global L */
const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const toLatLng = (p) => [p.lat, p.lon];
const PIN_LETTER = { origin: 'A', destination: 'B' };

/** Envuelve Leaflet. El resto de la app no sabe que existe Leaflet. */
export class MapView {
  #map;
  #networkLayer;
  #routeLayer;
  #markers = {};

  constructor(elementId, { center, zoom, tiles }) {
    this.#map = L.map(elementId, { preferCanvas: true }).setView(toLatLng(center), zoom);

    L.tileLayer(tiles.url, {
      maxZoom: tiles.maxZoom,
      attribution: tiles.attribution,
      className: 'base-tiles',
    }).addTo(this.#map);

    this.#networkLayer = L.layerGroup().addTo(this.#map);
    this.#routeLayer = L.layerGroup().addTo(this.#map);
  }

  onMapClick(handler) {
    this.#map.on('click', (e) => handler({ lat: e.latlng.lat, lon: e.latlng.lng }));
  }

  /** Solo los tramos: hay cientos de huecos posibles; se ven los que usa la ruta. */
  drawNetwork(ways) {
    const layer = this.#networkLayer;
    layer.clearLayers();
    const laneStyle = { color: cssVar('--network'), weight: 3, opacity: 0.85, interactive: false };

    for (const way of ways) {
      const coords = way.geometry.filter(Boolean).map(toLatLng);
      if (coords.length > 1) L.polyline(coords, laneStyle).addTo(layer);
    }
  }

  fitToWays(ways) {
    const coords = ways.flatMap((w) => w.geometry.filter(Boolean).map(toLatLng));
    if (coords.length) this.#map.fitBounds(L.latLngBounds(coords), { padding: [24, 24] });
  }

  setMarker(role, point, onMoved) {
    const latLng = toLatLng(point);
    const existing = this.#markers[role];
    if (existing) {
      existing.setLatLng(latLng);
      return;
    }
    const icon = L.divIcon({
      className: '',
      html: `<span class="pin pin--${role}">${PIN_LETTER[role]}</span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    const marker = L.marker(latLng, { icon, draggable: true, keyboard: true }).addTo(this.#map);
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      onMoved({ lat, lon: lng });
    });
    this.#markers[role] = marker;
  }

  removeMarker(role) {
    this.#markers[role]?.remove();
    delete this.#markers[role];
  }

  drawRoute(result, origin, destination) {
    const layer = this.#routeLayer;
    layer.clearLayers();

    const accessStyle = { color: cssVar('--access'), weight: 3, dashArray: '1 7', lineCap: 'round', interactive: false };
    L.polyline([toLatLng(origin), toLatLng(result.entry)], accessStyle).addTo(layer);
    L.polyline([toLatLng(result.exit), toLatLng(destination)], accessStyle).addTo(layer);

    const allPoints = [toLatLng(origin), toLatLng(destination)];
    for (const segment of result.segments) {
      const coords = segment.points.map(toLatLng);
      allPoints.push(...coords);
      if (segment.kind === 'gap') {
        L.polyline(coords, { color: cssVar('--gap'), weight: 5, dashArray: '6 6', interactive: false }).addTo(layer);
      } else {
        L.polyline(coords, { color: cssVar('--route-casing'), weight: 10, interactive: false }).addTo(layer);
        L.polyline(coords, { color: cssVar('--route'), weight: 6, interactive: false }).addTo(layer);
      }
    }

    const bounds = L.latLngBounds(allPoints);
    if (!this.#map.getBounds().contains(bounds)) {
      this.#map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  clearRoute() {
    this.#routeLayer.clearLayers();
  }
}
