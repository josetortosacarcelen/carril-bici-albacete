import { test } from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../js/App.js';
import { CyclewayGraphBuilder } from '../js/application/CyclewayGraphBuilder.js';
import { BikeRouteService } from '../js/application/BikeRouteService.js';
import { AStarPathFinder } from '../js/domain/AStarPathFinder.js';
import { BikeShareService } from '../js/application/BikeShareService.js';

// Un carril recto de ~860 m.
const WAYS = [{
  id: 1,
  tags: { highway: 'cycleway' },
  nodes: [1, 2],
  geometry: [{ lat: 39.0, lon: -1.86 }, { lat: 39.0, lon: -1.85 }],
}];
const WEST = { lat: 39.0, lon: -1.86 };
const EAST = { lat: 39.0, lon: -1.85 };
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Panel de mentira: guarda lo que se le pide y deja disparar sus eventos. */
function fakePanel() {
  const handlers = {};
  return {
    handlers,
    inputs: { origin: '', destination: '' },
    statuses: [],
    results: [],
    pickTarget: null,
    bikeShare: undefined,
    on(event, fn) { handlers[event] = fn; return this; },
    emit(event, ...args) { return handlers[event](...args); },
    setInputValue(role, text) { this.inputs[role] = text; },
    getInputValue(role) { return this.inputs[role].trim(); },
    setPickTarget(role) { this.pickTarget = role; },
    showStatus(message, tone) { this.statuses.push({ message, tone }); },
    showResult(result) { this.results.push(result); },
    showBikeShare(info) { this.bikeShare = info; },
    setGapTolerance() {}, showSuggestions() {}, hideSuggestions() {}, hideResult() {}, showNetworkStats() {},
  };
}

function fakeMap() {
  return {
    markers: {},
    routes: [],
    networkDraws: 0,
    stations: null,
    parkings: null,
    onMapClick(fn) { this.click = fn; },
    setMarker(role, point) { this.markers[role] = point; },
    removeMarker(role) { delete this.markers[role]; },
    drawNetwork() { this.networkDraws += 1; },
    drawRoute(result) { this.routes.push(result); },
    drawStations(stations, onPick) { this.stations = { stations, onPick }; },
    drawParkings(parkings) { this.parkings = parkings; },
    clearRoute() {}, fitToWays() {},
  };
}

function setup({ repository, stationRepository = null, places = {}, builder = new CyclewayGraphBuilder() } = {}) {
  const panel = fakePanel();
  const mapView = fakeMap();
  const searches = [];
  const downloads = [];
  const geocoder = {
    search: async (text) => { searches.push(text); return places[text] ? [places[text]] : []; },
    reverse: async () => 'Calle de prueba',
  };
  const app = new App({
    config: { city: 'Albacete', defaultGapToleranceM: 0, cyclingSpeedKmh: 15, bikeShare: { name: 'AlbaBici', refreshMs: 60000 } },
    repository: repository ?? { getNetwork: async () => ({ ways: WAYS, parkings: [] }), lastUpdated: () => null },
    bikeShare: stationRepository ? new BikeShareService({ repository: stationRepository, refreshMs: 60000 }) : null,
    graphBuilder: builder,
    routeService: new BikeRouteService({ pathFinder: new AStarPathFinder(), maxSnapDistanceM: 300 }),
    geocoder,
    mapView,
    panel,
    download: (filename, content, type) => downloads.push({ filename, content, type }),
  });
  return { app, panel, mapView, searches, downloads };
}

test('dos pulsaciones en el mapa colocan origen y destino y calculan la ruta', async () => {
  const { app, panel, mapView } = setup();
  await app.start();
  mapView.click(WEST);
  assert.equal(panel.pickTarget, 'destination');
  mapView.click(EAST);
  assert.equal(mapView.routes.length, 1);
  assert.ok(Math.abs(panel.results[0].laneDistanceM - 865) < 10);
  await flush();
  assert.equal(panel.inputs.origin, 'Calle de prueba');
});

test('al intercambiar, el texto editado se busca en su nuevo sitio', async () => {
  const nueva = { label: 'Calle Nueva 1', lat: 39.0, lon: -1.855 };
  const { app, panel, mapView, searches } = setup({ places: { 'Calle Nueva': nueva } });
  await app.start();
  mapView.click(WEST);
  mapView.click(EAST);
  await flush();

  panel.setInputValue('origin', 'Calle Nueva');
  panel.emit('inputEdited', 'origin');
  panel.emit('swap');
  await panel.emit('submit');

  assert.deepEqual(searches, ['Calle Nueva']);
  assert.deepEqual(mapView.markers.destination, { lat: nueva.lat, lon: nueva.lon });
  assert.deepEqual(mapView.markers.origin, EAST);
});

test('si falla la recarga, se mantiene la red que había', async () => {
  let calls = 0;
  const repository = {
    getNetwork: async () => { calls += 1; if (calls > 1) throw new Error('sin conexión'); return { ways: WAYS, parkings: [] }; },
    lastUpdated: () => null,
  };
  const { app, panel, mapView } = setup({ repository });
  await app.start();
  panel.emit('refresh');
  await flush();
  assert.equal(panel.statuses.at(-1).tone, 'error');
  assert.equal(mapView.networkDraws, 1);

  mapView.click(WEST);
  mapView.click(EAST);
  assert.equal(mapView.routes.length, 1, 'la red anterior sigue sirviendo para calcular rutas');
});

test('una estación de bici pública se puede usar como origen', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const station = { id: 's1', name: '03 - C/ Baños', lat: 39.0, lon: -1.86, freeBikes: 2 };
  const { app, panel, mapView } = setup({
    stationRepository: { getStations: async () => [station] },
  });
  await app.start();
  await flush();
  assert.deepEqual(mapView.stations.stations, [station]);

  mapView.stations.onPick('origin', station);
  assert.equal(panel.inputs.origin, 'AlbaBici: 03 - C/ Baños');
  assert.equal(panel.pickTarget, 'destination', 'el siguiente toque en el mapa pone el destino');
});

test('si no se pueden cargar las estaciones, la app funciona igual', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { app, mapView } = setup({
    stationRepository: { getStations: async () => { throw new Error('CityBikes caído'); } },
  });
  await app.start();
  await flush();
  assert.equal(mapView.stations, null);
  mapView.click(WEST);
  mapView.click(EAST);
  assert.equal(mapView.routes.length, 1);
});

test('descarga la ruta en GPX con los nombres de origen y destino', async () => {
  const { app, panel, mapView, downloads } = setup();
  await app.start();
  panel.emit('downloadGpx');
  assert.equal(downloads.length, 0, 'sin ruta no hay nada que descargar');

  mapView.click(WEST);
  mapView.click(EAST);
  await flush();
  panel.emit('downloadGpx');
  assert.equal(downloads.length, 1);
  assert.match(downloads[0].filename, /^ruta-carril-bici-\d{8}-\d{4}\.gpx$/);
  assert.equal(downloads[0].type, 'application/gpx+xml');
  assert.match(downloads[0].content, /<name>Calle de prueba → Calle de prueba<\/name>/);
  assert.equal((downloads[0].content.match(/<trkpt /g) ?? []).length >= 2, true);
});

test('con ruta y estaciones, propone dónde coger y dejar la bici', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const stations = [
    { id: 'w', name: 'Oeste', lat: 39.0, lon: -1.8601, online: true, freeBikes: 2, emptySlots: 0 },
    { id: 'e', name: 'Este', lat: 39.0, lon: -1.8499, online: true, freeBikes: 0, emptySlots: 4 },
  ];
  const { app, panel, mapView } = setup({ stationRepository: { getStations: async () => stations } });
  await app.start();
  await flush();
  assert.equal(panel.bikeShare, null, 'sin ruta no se propone nada');

  mapView.click(WEST);
  mapView.click(EAST);
  assert.equal(panel.bikeShare.pickup.station.id, 'w');
  assert.equal(panel.bikeShare.dropoff.station.id, 'e');
});

test('la red se construye con la preferencia de carril separado de la configuración', async () => {
  const builds = [];
  const real = new CyclewayGraphBuilder();
  const builder = { build: (ways, options) => { builds.push(options); return real.build(ways, options); } };
  const { app, panel } = setup({ builder });
  await app.start();
  panel.emit('gapChange', 40);
  assert.deepEqual(builds.map((o) => [o.preferSegregated, o.gapToleranceM]), [[true, 0], [true, 40]]);
});

test('los aparcabicis de la red se pintan en el mapa', async () => {
  const parkings = [{ id: 'node/1', lat: 39, lon: -1.86, capacity: 10, covered: false, name: null }];
  const { app, mapView } = setup({
    repository: { getNetwork: async () => ({ ways: WAYS, parkings }), lastUpdated: () => null },
  });
  await app.start();
  assert.deepEqual(mapView.parkings, parkings);
});
