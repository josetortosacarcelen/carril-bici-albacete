import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHash, versionImports, versionHtml } from '../scripts/versioning.js';

test('versionImports versiona los imports relativos y deja el resto', () => {
  const source = [
    "import { App } from './App.js';",
    "import { Graph } from '../domain/Graph.js';",
    "export { x } from \"./x.js\";",
    "import './side-effect.js';",
    "const m = await import('./lazy.js');",
    "import { readFile } from 'node:fs/promises';",
    "const texto = 'from ./no-es-import.js';",
  ].join('\n');
  const out = versionImports(source, 'abc').split('\n');
  assert.equal(out[0], "import { App } from './App.js?v=abc';");
  assert.equal(out[1], "import { Graph } from '../domain/Graph.js?v=abc';");
  assert.equal(out[2], 'export { x } from "./x.js?v=abc";');
  assert.equal(out[3], "import './side-effect.js?v=abc';");
  assert.equal(out[4], "const m = await import('./lazy.js?v=abc');");
  assert.equal(out[5], "import { readFile } from 'node:fs/promises';");
  assert.equal(out[6], "const texto = 'from ./no-es-import.js';");
  assert.equal(versionImports(out.join('\n'), 'abc'), out.join('\n'), 'no versiona dos veces');
});

test('versionHtml versiona solo js/ y css/ propios', () => {
  const html = '<link rel="stylesheet" href="css/styles.css"><link href="vendor/leaflet/leaflet.css">'
    + '<script src="vendor/leaflet/leaflet.js"></script><script type="module" src="js/main.js"></script>';
  const out = versionHtml(html, 'abc');
  assert.match(out, /href="css\/styles\.css\?v=abc"/);
  assert.match(out, /src="js\/main\.js\?v=abc"/);
  assert.match(out, /href="vendor\/leaflet\/leaflet\.css"/);
  assert.match(out, /src="vendor\/leaflet\/leaflet\.js"/);
});

test('contentHash cambia con el contenido y no con el orden', () => {
  const a = { path: 'a.js', content: 'uno' };
  const b = { path: 'b.js', content: 'dos' };
  assert.equal(contentHash([a, b]), contentHash([b, a]));
  assert.notEqual(contentHash([a, b]), contentHash([a, { ...b, content: 'tres' }]));
});
