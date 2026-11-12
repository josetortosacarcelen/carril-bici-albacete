/* global L */
import { cssVar, el, toLatLng } from './helpers.js';

/** Zoom mínimo para ver los aparcabicis: hay cientos y de lejos taparían el mapa. */
const MIN_ZOOM = 15;

/** Aparcabicis (puntos en el canvas del mapa, solo con el mapa acercado). */
export class ParkingLayer {
  #layer = L.layerGroup();

  constructor(map) {
    const toggle = () => {
      const visible = map.getZoom() >= MIN_ZOOM;
      if (visible && !map.hasLayer(this.#layer)) this.#layer.addTo(map);
      if (!visible && map.hasLayer(this.#layer)) this.#layer.remove();
    };
    map.on('zoomend', toggle);
    toggle();
  }

  draw(parkings) {
    this.#layer.clearLayers();
    const style = { radius: 5, color: '#fff', weight: 2, fillColor: cssVar('--parking'), fillOpacity: 1 };
    for (const parking of parkings) {
      L.circleMarker(toLatLng(parking), style).bindPopup(() => parkingPopup(parking)).addTo(this.#layer);
    }
  }
}

function parkingPopup(parking) {
  const root = el('div', 'parking-popup');
  root.append(el('p', 'station-popup__name', parking.name ?? 'Aparcabicis'));
  const details = [
    parking.capacity ? `${parking.capacity} plaza${parking.capacity === 1 ? '' : 's'}` : null,
    parking.covered ? 'cubierto' : null,
  ].filter(Boolean);
  if (details.length) root.append(el('p', 'station-popup__info', details.join(' · ')));
  return root;
}
