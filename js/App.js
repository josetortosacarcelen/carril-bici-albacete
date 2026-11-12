import { RouteError, RouteErrorCode } from './application/BikeRouteService.js';
import { toGpx, gpxFilename } from './application/gpx.js';
import { formatCoords } from './domain/geo.js';

/**
 * Controlador: mantiene el estado (origen, destino, red) y coordina
 * repositorio, servicios, mapa y panel. Recibe todo por inyección.
 */
export class App {
  #deps;
  #state = {
    ways: [],
    origin: null,
    destination: null,
    pickTarget: 'origin',
    gapToleranceM: 0,
    preferSegregated: true,
    edited: new Set(),
    lastRoute: null, // { result, origin, destination } de la ruta que se ve
  };

  constructor({
    repository, bikeShare = null, graphBuilder, routeService, geocoder, mapView, panel, config,
    download = () => {},
  }) {
    this.#deps = { repository, bikeShare, graphBuilder, routeService, geocoder, mapView, panel, config, download };
    this.#state.gapToleranceM = config.defaultGapToleranceM;
    this.#state.preferSegregated = config.preferSegregated ?? true;
  }

  async start() {
    const { panel } = this.#deps;
    panel.setGapTolerance(this.#state.gapToleranceM);
    panel.setPickTarget(this.#state.pickTarget);
    this.#bindEvents();
    this.#deps.bikeShare?.start((stations) => this.#onStations(stations));
    await this.#loadNetwork();
  }

  #onStations(stations) {
    const { mapView, config } = this.#deps;
    mapView.drawStations(stations, (role, station) =>
      this.#setPoint(role, station, { label: `${config.bikeShare.name}: ${station.name}`, advance: true }));
    this.#showBikeShare();
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
      .on('downloadGpx', () => this.#downloadGpx())
      .on('refresh', () => {
        this.#loadNetwork({ forceRefresh: true });
        this.#deps.bikeShare?.refresh();
      })
      .on('submit', () => this.#submit());
  }

  async #loadNetwork({ forceRefresh = false } = {}) {
    const { repository, mapView, panel } = this.#deps;
    panel.showStatus('Cargando la red de carriles bici…', 'info');
    let network;
    try {
      network = await repository.getNetwork({ forceRefresh });
    } catch (error) {
      // Si ya había una red cargada, se sigue usando.
      panel.showStatus(
        `No se pudo cargar la red (${error.message}). Comprueba la conexión y pulsa «Recargar datos».`,
        'error',
      );
      return;
    }
    this.#state.ways = network.ways;
    this.#rebuildNetwork();
    mapView.drawParkings(network.parkings ?? []);
    if (!this.#state.origin) mapView.fitToWays(network.ways);
    panel.showStatus('Pulsa en el mapa o escribe una dirección para empezar.', 'info');
    this.#tryRoute();
  }

  #rebuildNetwork() {
    const { graphBuilder, routeService, mapView, panel, repository } = this.#deps;
    const { ways, gapToleranceM, preferSegregated } = this.#state;
    const network = graphBuilder.build(ways, { gapToleranceM, preferSegregated });
    routeService.setNetwork(network);
    mapView.drawNetwork(ways);
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
        .reverse(location, { key: role })
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
          panel.showStatus(`No he encontrado «${text}» en ${this.#deps.config.city}. Prueba con otra forma de escribirla.`, 'warn');
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
    // La marca de «texto editado» viaja con el texto.
    const { edited } = this.#state;
    const originEdited = edited.has('origin');
    const destinationEdited = edited.has('destination');
    edited.clear();
    if (destinationEdited) edited.add('origin');
    if (originEdited) edited.add('destination');

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
    this.#state.lastRoute = null;
    mapView.clearRoute();
    panel.hideResult();
    panel.showStatus('Pulsa en el mapa o escribe una dirección para empezar.', 'info');
    this.#setPickTarget('origin');
  }

  #tryRoute() {
    const { routeService, mapView, panel, config } = this.#deps;
    const { origin, destination } = this.#state;
    this.#state.lastRoute = null;
    if (!origin || !destination) {
      mapView.clearRoute();
      panel.hideResult();
      return;
    }
    try {
      const result = routeService.route(origin, destination);
      this.#state.lastRoute = { result, origin, destination };
      mapView.drawRoute(result, origin, destination);
      panel.showResult(result, config.cyclingSpeedKmh);
      this.#showBikeShare();
      panel.showStatus('', 'info');
    } catch (error) {
      if (!(error instanceof RouteError)) throw error;
      mapView.clearRoute();
      panel.hideResult();
      if (error.code !== RouteErrorCode.NO_NETWORK) panel.showStatus(error.message, 'warn');
    }
  }

  #showBikeShare() {
    const { lastRoute } = this.#state;
    const { bikeShare, panel } = this.#deps;
    panel.showBikeShare(lastRoute && bikeShare ? bikeShare.suggest(lastRoute.origin, lastRoute.destination) : null);
  }

  #downloadGpx() {
    const { panel, download } = this.#deps;
    const { lastRoute } = this.#state;
    if (!lastRoute) return;
    const name = `${panel.getInputValue('origin') || 'Origen'} → ${panel.getInputValue('destination') || 'Destino'}`;
    const now = new Date();
    const creator = `Carril Bici ${this.#deps.config.city}`;
    download(gpxFilename(now), toGpx({ ...lastRoute, name, creator, time: now }), 'application/gpx+xml');
  }
}
