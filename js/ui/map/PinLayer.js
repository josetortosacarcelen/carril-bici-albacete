/* global L */
import { toLatLng } from './helpers.js';

const PIN_LETTER = { origin: 'A', destination: 'B' };

/** Marcadores A (origen) y B (destino), arrastrables. */
export class PinLayer {
  #map;
  #markers = {};

  constructor(map) {
    this.#map = map;
  }

  /** @param onMoved ({ lat, lon }) al soltar el marcador tras arrastrarlo */
  set(role, point, onMoved) {
    const existing = this.#markers[role];
    if (existing) {
      existing.setLatLng(toLatLng(point));
      return;
    }
    const icon = L.divIcon({
      className: '',
      html: `<span class="pin pin--${role}">${PIN_LETTER[role]}</span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    const marker = L.marker(toLatLng(point), { icon, draggable: true, keyboard: true }).addTo(this.#map);
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      onMoved({ lat, lon: lng });
    });
    this.#markers[role] = marker;
  }

  remove(role) {
    this.#markers[role]?.remove();
    delete this.#markers[role];
  }
}
