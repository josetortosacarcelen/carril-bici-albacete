import { formatDistance, formatDuration } from './format.js';

const plural = (n, one, many) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** Tarjeta con el resultado de la ruta: distancias, calles, bici pública y GPX. */
export class ResultView {
  #el;

  /**
   * @param {HTMLElement} root
   * @param {{ onDownloadGpx: () => void }} handlers onDownloadGpx: al pulsar «Descargar GPX»
   */
  constructor(root, { onDownloadGpx }) {
    const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (root.querySelector(`#${id}`));
    /** @type {(id: string) => [HTMLElement, HTMLElement]} */
    const row = (id) => [$(`${id}-row`), $(id)];
    this.#el = {
      root,
      total: $('result-total'),
      time: $('result-time'),
      lane: $('result-lane'),
      painted: row('result-painted'),
      shared: row('result-shared'),
      gap: row('result-gap'),
      access: $('result-access'),
      streets: row('result-streets'),
      bikeShare: row('result-bikeshare'),
    };
    $('gpx-btn').addEventListener('click', onDownloadGpx);
  }

  /**
   * @param {import('../domain/types.js').RouteResult} result
   * @param {number} speedKmh
   */
  show(result, speedKmh) {
    const el = this.#el;
    /** @type {(pair: [HTMLElement, HTMLElement], text: string, visible: boolean) => void} */
    const row = ([container, value], text, visible) => {
      value.textContent = text;
      container.hidden = !visible;
    };
    el.total.textContent = formatDistance(result.networkDistanceM);
    el.time.textContent = `≈ ${formatDuration(result.networkDistanceM, speedKmh)} a ${speedKmh} km/h`;
    el.lane.textContent = formatDistance(result.laneDistanceM);
    row(el.painted, formatDistance(result.paintedDistanceM), result.paintedDistanceM >= 1);
    row(el.shared, formatDistance(result.sharedDistanceM), result.sharedDistanceM >= 1);
    row(el.gap, formatDistance(result.gapDistanceM), result.gapDistanceM > 0);
    el.access.textContent = `${formatDistance(result.accessStartM)} al salir · ${formatDistance(result.accessEndM)} al llegar`;
    row(el.streets, result.streets.join(' → '), result.streets.length > 0);
    el.root.hidden = false;
  }

  /** @param {import('../domain/types.js').BikeShareSuggestion | null} info null para ocultar la fila */
  showBikeShare(info) {
    const [container, value] = this.#el.bikeShare;
    container.hidden = !info;
    if (!info) return;
    const pickup = info.pickup
      ? `Coger en ${info.pickup.station.name}: a ${formatDistance(info.pickup.distanceM)}, ${plural(info.pickup.station.freeBikes, 'bici', 'bicis')}`
      : 'Ninguna estación con bicis a menos de 1 km del origen';
    const dropoff = info.dropoff
      ? `Dejar en ${info.dropoff.station.name}: a ${formatDistance(info.dropoff.distanceM)}, ${plural(info.dropoff.station.emptySlots, 'anclaje libre', 'anclajes libres')}`
      : 'Ninguna estación con anclajes libres a menos de 1 km del destino';
    value.textContent = `${pickup}\n${dropoff}`;
  }

  hide() {
    this.#el.root.hidden = true;
  }
}
