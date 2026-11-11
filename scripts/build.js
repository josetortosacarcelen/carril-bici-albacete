#!/usr/bin/env node
// Copia a dist/ solo lo que se publica (sin tests, scripts ni configuración de repo).
import { cp, rm, mkdir } from 'node:fs/promises';

const OUT = 'dist';
const PUBLIC = ['index.html', 'favicon.svg', '404.html', 'css', 'js'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);
for (const entry of PUBLIC) await cp(entry, `${OUT}/${entry}`, { recursive: true });
console.log(`Sitio copiado a ${OUT}/`);
