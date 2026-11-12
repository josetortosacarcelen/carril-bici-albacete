/* global L */
import { el, toLatLng } from './helpers.js';

/**
 * Estaciones de bici pública con sus bicis libres. Se actualizan en el sitio,
 * sin cerrar la ventana de la estación que esté abierta.
 */
export class StationLayer {
  #layer;
  #markers = new Map();
  #stations = new Map();

  constructor(map) {
    this.#layer = L.layerGroup().addTo(map);
  }

  /**
   * @param {import('../../domain/types.js').Station[]} stations
   * @param {(role: import('../../domain/types.js').Role, station: import('../../domain/types.js').Station) => void} onPick al pulsar «Salir de aquí» o «Llegar aquí»
   */
  draw(stations, onPick) {
    const current = new Set();
    for (const station of stations) {
      current.add(station.id);
      this.#stations.set(station.id, station);
      const icon = stationIcon(station);
      const existing = this.#markers.get(station.id);
      if (existing) {
        existing.setIcon(icon);
        continue;
      }
      const marker = L.marker(toLatLng(station), { icon, title: station.name, keyboard: true, zIndexOffset: -500 })
        .addTo(this.#layer);
      marker.bindPopup(() => stationPopup(this.#stations.get(station.id), (role) => {
        marker.closePopup();
        onPick(role, this.#stations.get(station.id));
      }));
      this.#markers.set(station.id, marker);
    }
    for (const [id, marker] of this.#markers) {
      if (current.has(id)) continue;
      marker.remove();
      this.#markers.delete(id);
      this.#stations.delete(id);
    }
  }
}

function stationIcon(station) {
  const available = station.online && station.freeBikes > 0;
  const badge = el('span', available ? 'station' : 'station station--empty', station.online ? String(station.freeBikes) : '×');
  return L.divIcon({ className: '', html: badge, iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -12] });
}

function stationPopup(station, onPick) {
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
