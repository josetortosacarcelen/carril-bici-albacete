import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CyclewayGraphBuilder, bikeDirection } from '../js/application/CyclewayGraphBuilder.js';
import { BikeRouteService, RouteErrorCode } from '../js/application/BikeRouteService.js';
import { AStarPathFinder } from '../js/domain/AStarPathFinder.js';

// Ayuda: un tramo OSM a partir de [id, lat, lon]
const way = (id, points, tags = { highway: 'cycleway' }) => ({
  id,
  tags,
  nodes: points.map(([nodeId]) => nodeId),
  geometry: points.map(([, lat, lon]) => ({ lat, lon })),
});

const service = (ways, gapToleranceM = 0) => {
  const s = new BikeRouteService({ pathFinder: new AStarPathFinder(), maxSnapDistanceM: 300 });
  s.setNetwork(new CyclewayGraphBuilder().build(ways, { gapToleranceM }));
  return s;
};

// Un cuadrado: ruta corta por arriba (1→2→3) y larga por abajo (1→4→5→3).
const square = [
  way(10, [[1, 39.0, -1.86], [2, 39.0, -1.855], [3, 39.0, -1.85]]),
  way(11, [[1, 39.0, -1.86], [4, 38.995, -1.86], [5, 38.995, -1.85], [3, 39.0, -1.85]]),
];

test('elige el camino más corto de la red', () => {
  const r = service(square).route({ lat: 39.0, lon: -1.86 }, { lat: 39.0, lon: -1.85 });
  assert.ok(Math.abs(r.laneDistanceM - 865) < 10, `distancia ${r.laneDistanceM}`);
  assert.equal(r.gapDistanceM, 0);
});

test('respeta los carriles de sentido único', () => {
  const oneway = [way(20, [[1, 39.0, -1.86], [2, 39.0, -1.85]], { highway: 'cycleway', oneway: 'yes' })];
  const s = service(oneway);
  assert.ok(s.route({ lat: 39.0, lon: -1.86 }, { lat: 39.0, lon: -1.85 }));
  assert.throws(
    () => s.route({ lat: 39.0, lon: -1.85 }, { lat: 39.0, lon: -1.86 }),
    (e) => e.code === RouteErrorCode.NO_PATH,
  );
});

test('carril a contramano permite ambos sentidos', () => {
  assert.equal(bikeDirection({ highway: 'residential', oneway: 'yes', cycleway: 'opposite_lane' }), 0);
  assert.equal(bikeDirection({ highway: 'cycleway', 'oneway:bicycle': 'yes' }), 1);
});

test('un hueco corto solo se cruza si la tolerancia lo permite', () => {
  // Dos tramos separados ~9 m.
  const split = [
    way(30, [[1, 39.0, -1.86], [2, 39.0, -1.8551]]),
    way(31, [[3, 39.0, -1.855], [4, 39.0, -1.85]]),
  ];
  const from = { lat: 39.0, lon: -1.86 };
  const to = { lat: 39.0, lon: -1.85 };

  assert.throws(() => service(split, 0).route(from, to), (e) => e.code === RouteErrorCode.NO_PATH);

  const r = service(split, 20).route(from, to);
  assert.ok(r.gapDistanceM > 5 && r.gapDistanceM < 15, `hueco ${r.gapDistanceM}`);
  assert.deepEqual(r.segments.map((s) => s.kind), ['lane', 'gap', 'lane']);
});

test('avisa si la dirección está lejos de cualquier carril', () => {
  assert.throws(
    () => service(square).route({ lat: 39.02, lon: -1.86 }, { lat: 39.0, lon: -1.85 }),
    (e) => e.code === RouteErrorCode.ORIGIN_FAR,
  );
});
