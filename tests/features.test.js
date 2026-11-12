import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestStation } from '../js/application/nearestStation.js';
import { toGpx } from '../js/application/gpx.js';
import { CyclewayGraphBuilder, laneKind, LaneKind } from '../js/application/CyclewayGraphBuilder.js';
import { BikeRouteService } from '../js/application/BikeRouteService.js';
import { AStarPathFinder } from '../js/domain/AStarPathFinder.js';

const station = (id, lon, extra = {}) => ({ id, name: id, lat: 39.0, lon, online: true, freeBikes: 3, emptySlots: 3, ...extra });

test('nearestStation elige la más cercana que sirva para coger o dejar la bici', () => {
  const point = { lat: 39.0, lon: -1.86 };
  const stations = [
    station('vacía', -1.8601, { freeBikes: 0 }),          // ~9 m, sin bicis
    station('llena', -1.8602, { emptySlots: 0 }),         // ~17 m, sin anclajes
    station('cerrada', -1.8603, { online: false }),
    station('buena', -1.8610),                            // ~86 m
    station('lejos', -1.84),                              // ~1,7 km
  ];
  assert.equal(nearestStation(point, stations, 'bikes').station.id, 'llena');
  assert.equal(nearestStation(point, stations, 'slots').station.id, 'vacía');
  assert.ok(Math.abs(nearestStation(point, [stations[3]], 'bikes').distanceM - 86) < 2);
  assert.equal(nearestStation(point, [stations[4]], 'bikes'), null, 'a más de 1 km no cuenta');
  assert.equal(nearestStation(point, [], 'bikes'), null);
});

test('toGpx genera un track del origen al destino sin puntos repetidos', () => {
  const p = (lat, lon) => ({ lat, lon });
  const gpx = toGpx({
    origin: p(39.0001, -1.86),
    destination: p(39.0001, -1.85),
    result: {
      entry: p(39.0, -1.86),
      exit: p(39.0, -1.85),
      segments: [{ kind: 'lane', points: [p(39.0, -1.86), p(39.0, -1.855)] }, { kind: 'gap', points: [p(39.0, -1.855), p(39.0, -1.85)] }],
    },
    name: 'Calle A <B> & «C»',
    time: new Date('2026-11-12T10:00:00Z'),
  });
  const points = [...gpx.matchAll(/<trkpt lat="([\d.-]+)" lon="([\d.-]+)"/g)].map((m) => `${m[1]},${m[2]}`);
  assert.deepEqual(points, [
    '39.000100,-1.860000', '39.000000,-1.860000', '39.000000,-1.855000', '39.000000,-1.850000', '39.000100,-1.850000',
  ]);
  assert.match(gpx, /<name>Calle A &lt;B&gt; &amp; «C»<\/name>/);
  assert.match(gpx, /<time>2026-11-12T10:00:00.000Z<\/time>/);
  assert.match(gpx, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<gpx version="1.1"/);
});

test('laneKind distingue carril separado, pintado y compartido con peatones', () => {
  assert.equal(laneKind({ highway: 'cycleway' }), LaneKind.SEGREGATED);
  assert.equal(laneKind({ highway: 'residential', 'cycleway:right': 'track' }), LaneKind.SEGREGATED);
  assert.equal(laneKind({ highway: 'footway', bicycle: 'designated', segregated: 'yes' }), LaneKind.SEGREGATED);
  assert.equal(laneKind({ highway: 'footway', bicycle: 'designated' }), LaneKind.SHARED);
  assert.equal(laneKind({ highway: 'secondary', cycleway: 'lane' }), LaneKind.PAINTED);
  assert.equal(laneKind({ highway: 'cycleway', foot: 'designated', segregated: 'no' }), LaneKind.SHARED);
});

test('preferir carril separado evita el pintado si el rodeo es corto, y mide distancias reales', () => {
  // De 1 a 3: directo por carril pintado (~860 m) o rodeando por carril separado (~880 m, +2 %).
  const way = (id, points, tags) => ({
    id, tags, nodes: points.map(([n]) => n), geometry: points.map(([, lat, lon]) => ({ lat, lon })),
  });
  const ways = [
    way(1, [[1, 39.0, -1.86], [3, 39.0, -1.85]], { highway: 'secondary', cycleway: 'lane' }),
    way(2, [[1, 39.0, -1.86], [2, 39.0009, -1.855], [3, 39.0, -1.85]], { highway: 'cycleway' }),
  ];
  const route = (preferSegregated) => {
    const s = new BikeRouteService({ pathFinder: new AStarPathFinder(), maxSnapDistanceM: 50 });
    s.setNetwork(new CyclewayGraphBuilder().build(ways, { preferSegregated }));
    return s.route({ lat: 39.0, lon: -1.86 }, { lat: 39.0, lon: -1.85 });
  };
  const direct = route(false);
  assert.ok(Math.abs(direct.paintedDistanceM - 865) < 10, `pintado ${direct.paintedDistanceM}`);
  const safer = route(true);
  assert.equal(safer.paintedDistanceM, 0);
  assert.ok(safer.laneDistanceM > direct.laneDistanceM && safer.laneDistanceM < 900, `carril ${safer.laneDistanceM}`);
});
