import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FallbackCyclewayRepository } from '../js/infrastructure/FallbackCyclewayRepository.js';
import { buildCyclewayQuery, toWays } from '../js/infrastructure/overpassQuery.js';

const failing = (msg) => ({ getWays: async () => { throw new Error(msg); }, lastUpdated: () => null });
const working = (ways, date) => ({ getWays: async () => ways, lastUpdated: () => date });

test('usa el primer repositorio que responde', async () => {
  const date = new Date('2026-11-09');
  const repo = new FallbackCyclewayRepository([failing('sin archivo'), working([{ id: 1 }], date)]);
  assert.deepEqual(await repo.getWays(), [{ id: 1 }]);
  assert.equal(repo.lastUpdated(), date);
});

test('si todos fallan, junta los motivos', async () => {
  const repo = new FallbackCyclewayRepository([failing('A'), failing('B')]);
  await assert.rejects(repo.getWays(), /A · B/);
});

test('la consulta usa el rectángulo de la ciudad', () => {
  const q = buildCyclewayQuery({ south: 1, west: 2, north: 3, east: 4 });
  assert.match(q, /way\["highway"="cycleway"\]\(1,2,3,4\)/);
});

test('toWays descarta nodos y tramos sin geometría', () => {
  const ways = toWays({ elements: [
    { type: 'node', id: 1 },
    { type: 'way', id: 2, nodes: [1, 2], geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }] },
    { type: 'way', id: 3, nodes: [1, 2] },
  ] });
  assert.deepEqual(ways.map((w) => w.id), [2]);
  assert.deepEqual(ways[0].tags, {});
});
