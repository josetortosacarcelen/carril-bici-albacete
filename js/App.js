import { RouteError, RouteErrorCode } from './application/BikeRouteService.js';
import { formatCoords } from './ui/format.js';

/**
 * Controlador: mantiene el estado (origen, destino, red) y coordina
 * repositorio, servicio de rutas, mapa y panel. Recibe todo por inyección.
 */
export class App {
  #deps;
  #state = {
    ways: [],
    origin: null,
    destination: null,
    pickTarget: 'origin',
    gapToleranceM: 0,
    edited: new Set(),
  };

  constructor({ repository, graphBuilder, routeService, geocoder, mapView, panel, config }) {
    this.#deps = { repository, graphBuilder, routeService, geocoder, mapView, panel, config };
    this.#state.gapToleranceM = config.defaultGapToleranceM;
  }

  async start() {
    const { panel } = this.#deps;
    panel.setGapTolerance(this.#state.gapToleranceM);
    panel.setPickTarget(this.#state.pickTarget);
    this.#bindEvents();
    await this.#loadNetwork();
  }

  #bindEvents() {
    const { mapView, panel } = this.#deps;

    mapView.onMapClick((point) => this.#setPoint(this.#state.pickTarget, point, { reverse: true, advance: true }));

    panel
      .on('search', (role, text) => this.#search(role, text))
      .on('suggestionPick', (role, place) => this.#setPoint(role, place, { label: place.label }))
      .on('inputEdited', (role) => this.#state.edited.add(role))
      .on('pickTargetChange', (role) => this.#setPickTarget(role))
      .on('gapChange', (value) => this.#changeGapTolerance(value))
      .on('swap', () => this.#swap())
      .on('clear', () => this.#clear())
      .on('refresh', () => this.#loadNetwork({ forceRefresh: true }))
      .on('submit', () => this.#submit());
  }

  async #loadNetwork({ forceRefresh = false } = {}) {
    const { repository, mapView, panel } = this.#deps;
    panel.showStatus('Descargando la red de carriles bici de OpenStreetMap…', 'info');
    try {
      this.#state.ways = await repository.getWays({ forceRefresh });
      this.#rebuildNetwork();
      if (!this.#state.origin) mapView.fitToWays(this.#state.ways);
      panel.showStatus('Pulsa en el mapa o escribe una dirección para empezar.', 'info');
      this.#tryRoute();
    } catch (error) {
      panel.showStatus(
        `No se pudo descargar la red (${error.message}). Comprueba la conexión y pulsa «Actualizar datos».`,
        'error',
      );
    }
  }

  #rebuildNetwork() {
    const { graphBuilder, routeService, mapView, panel, repository } = this.#deps;
    const network = graphBuilder.build(this.#state.ways, { gapToleranceM: this.#state.gapToleranceM });
    routeService.setNetwork(network);
    mapView.drawNetwork(this.#state.ways, network.gaps);
    panel.showNetworkStats(network.stats, repository.lastUpdated());
  }

  #changeGapTolerance(value) {
    this.#state.gapToleranceM = value;
    if (this.#state.ways.length === 0) return;
    this.#rebuildNetwork();
    this.#tryRoute();
  }

  #setPickTarget(role) {
    this.#state.pickTarget = role;
    this.#deps.panel.setPickTarget(role);
  }

  #setPoint(role, point, { label, reverse = false, advance = false } = {}) {
    const { mapView, panel, geocoder } = this.#deps;
    const location = { lat: point.lat, lon: point.lon };
    this.#state[role] = location;
    this.#state.edited.delete(role);
    mapView.setMarker(role, location, (moved) => this.#setPoint(role, moved, { reverse: true }));

    if (label) {
      panel.setInputValue(role, label);
    } else if (reverse) {
      panel.setInputValue(role, 'Buscando la dirección…');
      geocoder
        .reverse(location)
        .catch(() => formatCoords(location))
        .then((text) => {
          if (this.#state[role] === location) panel.setInputValue(role, text || formatCoords(location));
        });
    }

    if (advance && role === 'origin' && !this.#state.destination) this.#setPickTarget('destination');
    this.#tryRoute();
  }

  async #search(role, text) {
    const { panel, geocoder } = this.#deps;
    if (!text) {
      panel.showStatus('Escribe una calle y un número antes de buscar.', 'warn');
      return [];
    }
    panel.showStatus(`Buscando «${text}»…`, 'info');
    try {
      const places = await geocoder.search(text);
      panel.showStatus('', 'info');
      panel.showSuggestions(role, places);
      return places;
    } catch (error) {
      panel.showStatus(`No se pudo buscar la dirección (${error.message}).`, 'error');
      return [];
    }
  }

  async #submit() {
    const { panel, geocoder } = this.#deps;
    for (const role of ['origin', 'destination']) {
      const needsLookup = !this.#state[role] || this.#state.edited.has(role);
      const text = panel.getInputValue(role);
      if (!needsLookup) continue;
      if (!text) {
        panel.showStatus(`Falta el ${role === 'origin' ? 'origen' : 'destino'}.`, 'warn');
        return;
      }
      try {
        const [first] = await geocoder.search(text);
        if (!first) {
          panel.showStatus(`No he encontrado «${text}» en Albacete. Prueba con otra forma de escribirla.`, 'warn');
          return;
        }
        this.#setPoint(role, first, { label: first.label });
      } catch (error) {
        panel.showStatus(`No se pudo buscar la dirección (${error.message}).`, 'error');
        return;
      }
    }
    this.#tryRoute();
  }

  #swap() {
    const { panel, mapView } = this.#deps;
    const { origin, destination } = this.#state;
    const originText = panel.getInputValue('origin');
    const destinationText = panel.getInputValue('destination');

    this.#state.origin = destination;
    this.#state.destination = origin;
    panel.setInputValue('origin', destinationText);
    panel.setInputValue('destination', originText);

    for (const role of ['origin', 'destination']) {
      const point = this.#state[role];
      if (point) mapView.setMarker(role, point, (moved) => this.#setPoint(role, moved, { reverse: true }));
      else mapView.removeMarker(role);
    }
    this.#tryRoute();
  }

  #clear() {
    const { panel, mapView } = this.#deps;
    for (const role of ['origin', 'destination']) {
      this.#state[role] = null;
      mapView.removeMarker(role);
      panel.setInputValue(role, '');
      panel.hideSuggestions(role);
    }
    this.#state.edited.clear();
    mapView.clearRoute();
    panel.hideResult();
    panel.showStatus('Pulsa en el mapa o escribe una dirección para empezar.', 'info');
    this.#setPickTarget('origin');
  }

  #tryRoute() {
    const { routeService, mapView, panel, config } = this.#deps;
    const { origin, destination } = this.#state;
    if (!origin || !destination) {
      mapView.clearRoute();
      panel.hideResult();
      return;
    }
    try {
      const result = routeService.route(origin, destination);
      mapView.drawRoute(result, origin, destination);
      panel.showResult(result, config.cyclingSpeedKmh);
      panel.showStatus('', 'info');
    } catch (error) {
      if (!(error instanceof RouteError)) throw error;
      mapView.clearRoute();
      panel.hideResult();
      if (error.code !== RouteErrorCode.NO_NETWORK) panel.showStatus(error.message, 'warn');
    }
  }
}
