#!/usr/bin/env node
// Descarga la red de carril bici de OpenStreetMap y la guarda como archivo
// estático para servirla junto a la web. Se ejecuta en cada despliegue.
//   node scripts/fetch-network.js [ruta-de-salida]
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { CONFIG } from '../js/config.js';
import { OverpassClient } from '../js/infrastructure/OverpassClient.js';
import { buildCyclewayQuery, toWays } from '../js/infrastructure/overpassQuery.js';

const MIN_EXPECTED_WAYS = 20; // por debajo, algo ha ido mal: mejor no publicar

const output = process.argv[2] ?? CONFIG.staticNetworkUrl;
const client = new OverpassClient({ endpoints: CONFIG.overpassUrls, timeoutMs: 120000,
  userAgent: 'carril-bici-albacete/1.0',
});

const ways = toWays(await client.query(buildCyclewayQuery(CONFIG.bbox)));
if (ways.length < MIN_EXPECTED_WAYS) {
  console.error(`Solo ${ways.length} tramos: no se publica para no romper la app.`);
  process.exit(1);
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), ways }));
console.log(`${ways.length} tramos guardados en ${output}`);
