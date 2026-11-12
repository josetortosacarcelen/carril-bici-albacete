import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter, SupersededError } from '../js/infrastructure/RateLimiter.js';

test('separa el inicio de cada tarea al menos el intervalo', async () => {
  const limiter = new RateLimiter(40);
  const starts = [];
  const task = () => { starts.push(Date.now()); return 'ok'; };
  await Promise.all([limiter.schedule(task), limiter.schedule(task), limiter.schedule(task)]);
  assert.equal(starts.length, 3);
  assert.ok(starts[1] - starts[0] >= 38 && starts[2] - starts[1] >= 38, `inicios ${starts}`);
});

test('una tarea con la misma clave sustituye a la que espera turno', async () => {
  const limiter = new RateLimiter(30);
  const ran = [];
  const job = (name) => () => { ran.push(name); return name; };
  const first = limiter.schedule(job('primera'), { key: 'origin' }); // arranca ya
  const second = limiter.schedule(job('segunda'), { key: 'origin' }); // espera turno…
  const other = limiter.schedule(job('destino'), { key: 'destination' });
  const third = limiter.schedule(job('tercera'), { key: 'origin' }); // …y esta la sustituye
  await assert.rejects(second, SupersededError);
  assert.deepEqual(await Promise.all([first, other, third]), ['primera', 'destino', 'tercera']);
  assert.deepEqual(ran, ['primera', 'destino', 'tercera']);
});

test('un error en una tarea no bloquea las siguientes', async () => {
  const limiter = new RateLimiter(10);
  const failing = limiter.schedule(() => { throw new Error('caído'); });
  const next = limiter.schedule(() => 'sigue');
  await assert.rejects(failing, /caído/);
  assert.equal(await next, 'sigue');
});
