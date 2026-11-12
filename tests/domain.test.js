import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MinHeap } from '../js/domain/MinHeap.js';
import { DisjointSet } from '../js/domain/DisjointSet.js';
import { SpatialIndex } from '../js/domain/SpatialIndex.js';
import { SegmentIndex, projectOnSegment } from '../js/domain/SegmentIndex.js';
import { Graph } from '../js/domain/Graph.js';
import { distancesWithin } from '../js/domain/distancesWithin.js';
import { formatLabel } from '../js/infrastructure/NominatimGeocoder.js';

test('MinHeap saca siempre el de menor prioridad', () => {
  const heap = new MinHeap();
  const priorities = [5, 1, 9, 3, 3, 0, 7, 2, 8, 6, 4];
  priorities.forEach((p) => heap.push(p, `v${p}`));
  const out = [];
  while (heap.size > 0) out.push(heap.pop().priority);
  assert.deepEqual(out, [...priorities].sort((a, b) => a - b));
  assert.equal(heap.pop(), undefined);
});

test('DisjointSet une conjuntos y cuenta los que quedan', () => {
  const set = new DisjointSet();
  ['a', 'b', 'c', 'd'].forEach((id) => set.add(id));
  assert.equal(set.count, 4);
  assert.equal(set.union('a', 'b'), true);
  assert.equal(set.union('c', 'd'), true);
  assert.equal(set.union('b', 'a'), false, 'ya estaban unidos');
  assert.equal(set.count, 2);
  set.union('a', 'd');
  assert.equal(set.find('b'), set.find('c'));
  assert.equal(set.count, 1);
});

test('SpatialIndex encuentra los puntos dentro del radio y el más cercano', () => {
  const index = new SpatialIndex({ cellSizeM: 50, referenceLat: 39 });
  const near = { id: 1, lat: 39.0, lon: -1.8601 };   // ~9 m
  const mid = { id: 2, lat: 39.0, lon: -1.8605 };    // ~43 m
  const far = { id: 3, lat: 39.01, lon: -1.86 };     // ~1,1 km
  [near, mid, far].forEach((p) => index.insert(p));
  const point = { lat: 39.0, lon: -1.86 };
  assert.deepEqual(index.within(point, 100).map((f) => f.item.id).sort(), [1, 2]);
  assert.equal(index.nearest(point, 100).item.id, 1);
  assert.equal(index.nearest(point, 5), null);
});

test('projectOnSegment proyecta dentro del segmento y se queda en los extremos', () => {
  const a = { lat: 39.0, lon: -1.86 };
  const b = { lat: 39.0, lon: -1.85 };
  const middle = projectOnSegment({ lat: 39.001, lon: -1.855 }, a, b);
  assert.ok(Math.abs(middle.t - 0.5) < 1e-9);
  assert.ok(Math.abs(middle.point.lat - 39.0) < 1e-12);
  assert.equal(projectOnSegment({ lat: 39.0, lon: -1.87 }, a, b).t, 0);
  assert.equal(projectOnSegment({ lat: 39.0, lon: -1.84 }, a, b).t, 1);
  assert.equal(projectOnSegment({ lat: 39.0, lon: -1.84 }, a, a).t, 0, 'segmento de longitud cero');
});

test('SegmentIndex encuentra un tramo largo aunque sus extremos estén lejos', () => {
  const index = new SegmentIndex({ cellSizeM: 50, referenceLat: 39 });
  const segment = { a: { lat: 39.0, lon: -1.87 }, b: { lat: 39.0, lon: -1.83 } }; // ~3,5 km
  index.insert(segment);
  const [found] = index.within({ lat: 39.0003, lon: -1.85 }, 50);
  assert.equal(found.segment, segment);
  assert.ok(Math.abs(found.distance - 33) < 1, `distancia ${found.distance}`);
  assert.deepEqual(index.within({ lat: 39.001, lon: -1.85 }, 50), []);
});

test('distancesWithin respeta el sentido y el límite', () => {
  const g = new Graph();
  [1, 2, 3, 4].forEach((id) => g.addNode(id, 0, 0));
  g.addEdge(1, 2, 10);
  g.addEdge(2, 3, 10);
  g.addEdge(3, 4, 10);
  g.addEdge(4, 1, 1); // atajo solo de vuelta
  const d = distancesWithin(g, 1, 25);
  assert.deepEqual([...d.entries()].sort(), [[1, 0], [2, 10], [3, 20]]);
});

test('formatLabel da una dirección corta y legible', () => {
  assert.equal(
    formatLabel({ address: { road: 'Calle Baños', house_number: '25', suburb: 'Centro' } }),
    'Calle Baños 25 (Centro)',
  );
  assert.equal(formatLabel({ address: { pedestrian: 'Plaza Mayor' } }), 'Plaza Mayor');
  assert.equal(formatLabel({ display_name: 'Parque Abelardo Sánchez, Albacete, España' }), 'Parque Abelardo Sánchez, Albacete');
  assert.equal(formatLabel(null), '');
});
