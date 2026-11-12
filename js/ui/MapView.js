/* global L */
import { cssVar, toLatLng } from './map/helpers.js';
import { RouteLayer } from './map/RouteLayer.js';
import { PinLayer } from './map/PinLayer.js';
import { StationLayer } from './map/StationLayer.js';
import { ParkingLayer } from './map/ParkingLayer.js';

/**
 * Fachada del mapa: el resto de la app no sabe que existe Leaflet.
 * Cada capa vive en ui/map/; aquí solo se crea el mapa, se pinta la red y se delega.
 */
export class MapView {
  #map;
  #networkLayer;
  #route;
  #pins;
  #stations;
  #parkings;

  constructor(elementId, { center, zoom, tiles }) {
    this.#map = L.map(elementId, { preferCanvas: true }).setView(toLatLng(center), zoom);
    L.tileLayer(tiles.url, { maxZoom: tiles.maxZoom, attribution: tiles.attribution, className: 'base-tiles' })
      .addTo(this.#map);

    // El orden de creación es el orden de dibujo: red, ruta, estaciones; aparcabicis según el zoom.
    this.#networkLayer = L.layerGroup().addTo(this.#map);
    this.#route = new RouteLayer(this.#map);
    this.#stations = new StationLayer(this.#map);
    this.#parkings = new ParkingLayer(this.#map);
    this.#pins = new PinLayer(this.#map);
  }

  onMapClick(handler) {
    this.#map.on('click', (e) => handler({ lat: e.latlng.lat, lon: e.latlng.lng }));
  }

  /** Solo los tramos: hay cientos de huecos posibles; se ven los que usa la ruta. */
  drawNetwork(ways) {
    const layer = this.#networkLayer;
    layer.clearLayers();
    const style = { color: cssVar('--network'), weight: 3, opacity: 0.85, interactive: false };
    for (const way of ways) {
      const coords = way.geometry.filter(Boolean).map(toLatLng);
      if (coords.length > 1) L.polyline(coords, style).addTo(layer);
    }
  }

  fitToWays(ways) {
    const coords = ways.flatMap((w) => w.geometry.filter(Boolean).map(toLatLng));
    if (coords.length) this.#map.fitBounds(L.latLngBounds(coords), { padding: [24, 24] });
  }

  drawRoute(result, origin, destination) { this.#route.draw(result, origin, destination); }
  clearRoute() { this.#route.clear(); }
  setMarker(role, point, onMoved) { this.#pins.set(role, point, onMoved); }
  removeMarker(role) { this.#pins.remove(role); }
  drawStations(stations, onPick) { this.#stations.draw(stations, onPick); }
  drawParkings(parkings) { this.#parkings.draw(parkings); }
}
