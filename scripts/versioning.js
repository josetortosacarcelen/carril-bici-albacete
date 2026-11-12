// Versionado de recursos para el despliegue: añade `?v=<hash>` a los imports
// relativos de los módulos y a las referencias de index.html. Así el navegador
// nunca mezcla en su caché módulos de dos versiones distintas.
import { createHash } from 'node:crypto';

/** Hash corto del contenido de una lista de archivos [{ path, content }]. */
export function contentHash(files) {
  const hash = createHash('sha256');
  for (const { path, content } of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(path).update('\0').update(content).update('\0');
  }
  return hash.digest('hex').slice(0, 10);
}

/** `from './x.js'`, `import './x.js'` e `import('./x.js')` → con `?v=version`. */
export function versionImports(source, version) {
  return source.replace(
    /(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[^'"?]+\.js)\2/g,
    (_, prefix, quote, path) => `${prefix}${quote}${path}?v=${version}${quote}`,
  );
}

/** Referencias propias de index.html (js/ y css/) → con `?v=version`. */
export function versionHtml(html, version) {
  return html.replace(
    /((?:src|href)=")((?:js|css)\/[^"?]+\.(?:js|css))"/g,
    (_, attr, path) => `${attr}${path}?v=${version}"`,
  );
}
