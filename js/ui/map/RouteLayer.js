/* global L */
import { EdgeKind } from '../../domain/edges.js';
import { cssVar, toLatLng } from './helpers.js';

/** La ruta calculada: tramos de carril, huecos unidos y accesos desde/hasta el carril. */
export class RouteLayer {
  #map;
  #layer;

  constructor(map) {
    this.#map = map;
    this.#layer = L.layerGroup().addTo(map);
  }

  draw(result, origin, destination) {
    const layer = this.#layer;
    layer.clearLayers();

    const accessStyle = { color: cssVar('--access'), weight: 3, dashArray: '1 7', lineCap: 'round', interactive: false };
    L.polyline([toLatLng(origin), toLatLng(result.entry)], accessStyle).addTo(layer);
    L.polyline([toLatLng(result.exit), toLatLng(destination)], accessStyle).addTo(layer);

    const allPoints = [toLatLng(origin), toLatLng(destination)];
    for (const segment of result.segments) {
      const coords = segment.points.map(toLatLng);
      allPoints.push(...coords);
      if (segment.kind === EdgeKind.GAP) {
        L.polyline(coords, { color: cssVar('--gap'), weight: 5, dashArray: '6 6', interactive: false }).addTo(layer);
      } else {
        L.polyline(coords, { color: cssVar('--route-casing'), weight: 10, interactive: false }).addTo(layer);
        L.polyline(coords, { color: cssVar('--route'), weight: 6, interactive: false }).addTo(layer);
      }
    }

    // Solo se mueve el mapa si la ruta no cabe en lo que ya se ve.
    const bounds = L.latLngBounds(allPoints);
    if (!this.#map.getBounds().contains(bounds)) this.#map.fitBounds(bounds, { padding: [40, 40] });
  }

  clear() {
    this.#layer.clearLayers();
  }
}
