#!/usr/bin/env node
// Copia a dist/ solo lo que se publica (sin tests, scripts ni configuración de repo)
// y versiona los módulos y estilos para que la caché del navegador no los mezcle.
import { cp, rm, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { contentHash, versionImports, versionHtml } from './versioning.js';

const OUT = 'dist';
const PUBLIC = ['index.html', 'favicon.svg', '404.html', 'css', 'js', 'fonts', 'vendor'];

async function filesIn(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath ?? e.path, e.name));
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);
for (const entry of PUBLIC) await cp(entry, `${OUT}/${entry}`, { recursive: true });

const versioned = [...await filesIn('js'), ...await filesIn('css')];
const version = contentHash(await Promise.all(
  versioned.map(async (path) => ({ path, content: await readFile(path) })),
));

for (const path of versioned.filter((p) => p.endsWith('.js'))) {
  const target = join(OUT, path);
  await writeFile(target, versionImports(await readFile(target, 'utf8'), version));
}
const html = join(OUT, 'index.html');
await writeFile(html, versionHtml(await readFile(html, 'utf8'), version));

console.log(`Sitio copiado a ${OUT}/ (versión ${version})`);
