/* global L */
const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const toLatLng = (p) => [p.lat, p.lon];
const PIN_LETTER = { origin: 'A', destination: 'B' };
const PARKING_MIN_ZOOM = 15;

/** Envuelve Leaflet. El resto de la app no sabe que existe Leaflet. */
export class MapView {
  #map;
  #networkLayer;
  #routeLayer;
  #stationLayer;
  #parkingLayer;
  #stationMarkers = new Map();
  #stations = new Map();
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
    this.#stationLayer = L.layerGroup().addTo(this.#map);
    // Aparcabicis: hay cientos; solo se muestran con el mapa acercado.
    this.#parkingLayer = L.layerGroup();
    const toggleParkings = () => {
      const visible = this.#map.getZoom() >= PARKING_MIN_ZOOM;
      if (visible && !this.#map.hasLayer(this.#parkingLayer)) this.#parkingLayer.addTo(this.#map);
      if (!visible && this.#map.hasLayer(this.#parkingLayer)) this.#parkingLayer.remove();
    };
    this.#map.on('zoomend', toggleParkings);
    toggleParkings();
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

  /**
   * Estaciones de bici pública con sus bicis libres. Se actualizan en el
   * sitio, sin cerrar la ventana de la estación que esté abierta.
   * @param onPick (role, station) al pulsar «Salir de aquí» o «Llegar aquí».
   */
  drawStations(stations, onPick) {
    const current = new Set();
    for (const station of stations) {
      current.add(station.id);
      this.#stations.set(station.id, station);
      const icon = stationIcon(station);
      let marker = this.#stationMarkers.get(station.id);
      if (marker) {
        marker.setIcon(icon);
        continue;
      }
      marker = L.marker(toLatLng(station), { icon, title: station.name, keyboard: true, zIndexOffset: -500 })
        .addTo(this.#stationLayer);
      marker.bindPopup(() => stationPopup(this.#stations.get(station.id), (role) => {
        marker.closePopup();
        onPick(role, this.#stations.get(station.id));
      }));
      this.#stationMarkers.set(station.id, marker);
    }
    for (const [id, marker] of this.#stationMarkers) {
      if (current.has(id)) continue;
      marker.remove();
      this.#stationMarkers.delete(id);
      this.#stations.delete(id);
    }
  }

  drawParkings(parkings) {
    const layer = this.#parkingLayer;
    layer.clearLayers();
    const style = { radius: 5, color: '#fff', weight: 2, fillColor: cssVar('--parking'), fillOpacity: 1 };
    for (const parking of parkings) {
      L.circleMarker(toLatLng(parking), style).bindPopup(() => parkingPopup(parking)).addTo(layer);
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

function stationIcon(station) {
  const badge = document.createElement('span');
  const available = station.online && station.freeBikes > 0;
  badge.className = available ? 'station' : 'station station--empty';
  badge.textContent = station.online ? String(station.freeBikes) : '×';
  return L.divIcon({ className: '', html: badge, iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -12] });
}

/** Contenido de la ventana de una estación (con textContent: datos externos). */
function stationPopup(station, onPick) {
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const root = el('div', 'station-popup');
  root.append(el('p', 'station-popup__name', station.name));

  if (station.online) {
    const bikes = station.freeBikes === 1 ? '1 bici libre' : `${station.freeBikes} bicis libres`;
    const ebikes = station.ebikes > 0 ? ` (${station.ebikes} eléctrica${station.ebikes === 1 ? '' : 's'})` : '';
    const slots = station.emptySlots === 1 ? '1 anclaje libre' : `${station.emptySlots} anclajes libres`;
    root.append(el('p', 'station-popup__info', `${bikes}${ebikes} · ${slots}`));
  } else {
    root.append(el('p', 'station-popup__info', 'Fuera de servicio'));
  }

  const actions = el('div', 'station-popup__actions');
  for (const [role, text] of [['origin', 'Salir de aquí'], ['destination', 'Llegar aquí']]) {
    const button = el('button', 'btn btn--quiet', text);
    button.type = 'button';
    button.addEventListener('click', () => onPick(role));
    actions.append(button);
  }
  root.append(actions);
  return root;
}

function parkingPopup(parking) {
  const root = document.createElement('div');
  root.className = 'parking-popup';
  const title = document.createElement('p');
  title.className = 'station-popup__name';
  title.textContent = parking.name ?? 'Aparcabicis';
  const details = [
    parking.capacity ? `${parking.capacity} plaza${parking.capacity === 1 ? '' : 's'}` : null,
    parking.covered ? 'cubierto' : null,
  ].filter(Boolean);
  root.append(title);
  if (details.length) {
    const info = document.createElement('p');
    info.className = 'station-popup__info';
    info.textContent = details.join(' · ');
    root.append(info);
  }
  return root;
}
