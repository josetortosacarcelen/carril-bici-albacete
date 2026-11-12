#!/usr/bin/env node
// Compara el enrutado del árbol de trabajo con el de otro commit sobre la red real.
//   node scripts/bench-routing.js [commit=HEAD] [toleranciaM=20]
// Necesita data/red-carril-bici.json (npm run fetch-network). Puntos aleatorios con semilla fija:
// mismo resultado en cada ejecución. Sirve para cualquier cambio en domain/ o application/.
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [ref = 'HEAD', tolerance = '20'] = process.argv.slice(2);
const gapToleranceM = Number(tolerance);
const PAIRS = 150;
const { ways } = JSON.parse(readFileSync('data/red-carril-bici.json', 'utf8'));

const oldDir = mkdtempSync(join(tmpdir(), 'bench-'));
execSync(`git archive ${ref} js | tar -x -C ${oldDir}`);

let seed = 42;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const points = Array.from({ length: PAIRS * 2 }, () => ({ lat: 38.97 + rnd() * 0.04, lon: -1.885 + rnd() * 0.05 }));

async function run(root) {
  const { CyclewayGraphBuilder } = await import(`${root}/js/application/CyclewayGraphBuilder.js`);
  const { BikeRouteService } = await import(`${root}/js/application/BikeRouteService.js`);
  const { AStarPathFinder } = await import(`${root}/js/domain/AStarPathFinder.js`);
  let t = performance.now();
  const network = new CyclewayGraphBuilder().build(ways, { gapToleranceM, preferSegregated: true });
  const buildMs = performance.now() - t;
  const service = new BikeRouteService({ pathFinder: new AStarPathFinder(), maxSnapDistanceM: 500 });
  service.setNetwork(network);
  t = performance.now();
  const routes = [];
  for (let i = 0; i < points.length; i += 2) {
    try { routes.push(service.route(points[i], points[i + 1])); } catch { routes.push(null); }
  }
  return { routes, buildMs, routeMs: (performance.now() - t) / PAIRS, gaps: network.gaps.length };
}

const total = (r) => r.networkDistanceM + r.accessStartM + r.accessEndM;
const [before, after] = [await run(oldDir), await run(resolve('.'))];
rmSync(oldDir, { recursive: true, force: true });

const both = before.routes.map((b, i) => [b, after.routes[i]]).filter(([b, a]) => b && a);
const diffs = both.map(([b, a]) => total(a) - total(b));
const row = (name, x) => ({
  versión: name,
  rutas: `${x.routes.filter(Boolean).length}/${PAIRS}`,
  'construir ms': Math.round(x.buildMs),
  'ms/ruta': +x.routeMs.toFixed(2),
  huecos: x.gaps,
});
console.log(`Red: ${ways.length} tramos · tolerancia ${gapToleranceM} m · ${PAIRS} pares`);
console.table([row(ref, before), row('trabajo', after)]);
console.log({
  'rutas comunes': both.length,
  'más cortas ahora': diffs.filter((d) => d < -1).length,
  'más largas ahora': diffs.filter((d) => d > 1).length,
  'diferencia media (m)': Math.round(diffs.reduce((s, d) => s + d, 0) / (both.length || 1)),
});
