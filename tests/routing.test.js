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

test('las rotondas son de sentido único aunque no lleven oneway', () => {
  assert.equal(bikeDirection({ highway: 'tertiary', junction: 'roundabout', cycleway: 'lane' }), 1);
  assert.equal(bikeDirection({ junction: 'roundabout', 'oneway:bicycle': 'no' }), 0);
  assert.equal(bikeDirection({ highway: 'cycleway', oneway: '1' }), 1);
});

test('une todos los cruces útiles entre dos redes, no solo el más corto', () => {
  // Dos carriles paralelos a ~11 m, sin conexión. Cerca de cada extremo hay un cruce.
  const parallel = [
    way(40, [[1, 39.0, -1.86], [2, 39.0, -1.85]]),
    way(41, [[3, 39.0001, -1.86], [4, 39.00012, -1.85]]),
  ];
  // Del extremo este de uno al extremo este del otro: saltar el hueco de ~13 m,
  // no ir hasta el oeste por el cruce más corto (~11 m) y volver (~1,7 km).
  const r = service(parallel, 20).route({ lat: 39.0, lon: -1.85 }, { lat: 39.00012, lon: -1.85 });
  assert.ok(r.networkDistanceM < 20, `distancia ${r.networkDistanceM}`);
});

test('no inventa huecos donde el carril ya conecta sin rodeo', () => {
  // Un tramo en L: las puntas están a ~14 m en línea recta y a ~20 m por el carril.
  const corner = [way(50, [[1, 39.0, -1.86], [2, 39.0, -1.8599], [3, 39.0001, -1.8599]])];
  assert.deepEqual(new CyclewayGraphBuilder().build(corner, { gapToleranceM: 20 }).gaps, []);
});

test('se engancha al punto más cercano del tramo, no solo a sus nodos', () => {
  // Tramo de ~860 m con solo dos nodos; el origen está a ~110 m del centro del tramo.
  const long = [way(60, [[1, 39.0, -1.86], [2, 39.0, -1.85]])];
  const r = service(long).route({ lat: 39.001, lon: -1.855 }, { lat: 39.0, lon: -1.85 });
  assert.ok(Math.abs(r.accessStartM - 111) < 5, `acceso ${r.accessStartM}`);
  assert.ok(Math.abs(r.laneDistanceM - 432) < 10, `carril ${r.laneDistanceM}`);
  assert.ok(Math.abs(r.entry.lon - -1.855) < 1e-6);
});

test('si el carril más cercano no lleva al destino, prueba otro', () => {
  // A: sentido único hacia el este, aislado, a ~11 m del origen.
  // B: doble sentido, a ~33 m del origen, y es donde está el destino.
  const ways = [
    way(70, [[1, 39.0, -1.86], [2, 39.0, -1.85]], { highway: 'cycleway', oneway: 'yes' }),
    way(71, [[3, 39.0004, -1.86], [4, 39.0004, -1.85]]),
  ];
  const r = service(ways).route({ lat: 39.0001, lon: -1.851 }, { lat: 39.0004, lon: -1.8595 });
  assert.ok(Math.abs(r.accessStartM - 33) < 3, `acceso ${r.accessStartM}`);
});

test('origen y destino en el mismo tramo, respetando el sentido', () => {
  const oneway = [way(80, [[1, 39.0, -1.86], [2, 39.0, -1.85]], { highway: 'cycleway', oneway: 'yes' })];
  const s = service(oneway);
  const r = s.route({ lat: 39.0, lon: -1.858 }, { lat: 39.0, lon: -1.852 });
  assert.ok(Math.abs(r.laneDistanceM - 519) < 10, `carril ${r.laneDistanceM}`);
  assert.throws(
    () => s.route({ lat: 39.0, lon: -1.852 }, { lat: 39.0, lon: -1.858 }),
    (e) => e.code === RouteErrorCode.NO_PATH,
  );
});
