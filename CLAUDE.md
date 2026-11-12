# CLAUDE.md — Carril Bici Albacete

Web estática que calcula la ruta más corta entre dos puntos de Albacete **usando solo carril bici**.
Datos de OpenStreetMap (Overpass), direcciones con Nominatim, mapa con Leaflet, ruta con A*.

## Comandos

| Qué | Comando |
|---|---|
| Tests (Node, sin navegador, ~0,1 s) | `npm test` |
| Servir en local | `npm start` → http://localhost:8000 (no `0.0.0.0`) |
| Descargar red a `data/` (opcional en local) | `npm run fetch-network` |
| Construir `dist/` | `npm run build` |
| Desplegar (solo manual, ver «Estado») | `gh workflow run deploy.yml` y `gh run list -L 1` |

No hay `npm install`: **cero dependencias**. Node ≥ 18 (fetch nativo). Leaflet llega por CDN (unpkg, con SRI).

## Mapa del código (`js/`)

Capas con dependencias solo hacia dentro: `ui → application → domain`; `infrastructure` implementa interfaces.

- `domain/` — puro, testeable en Node: `Graph`, `AStarPathFinder`, `MinHeap`, `DisjointSet`, `SpatialIndex` (nodos en rejilla), `SegmentIndex` (segmentos en rejilla + `projectOnSegment`), `distancesWithin` (Dijkstra acotado), `geo.haversine`.
- `application/CyclewayGraphBuilder.js` — tramos OSM → `{ graph, segments: SegmentIndex, gaps, stats }`.
  - `bikeDirection(tags)` → 1 / -1 / 0. Rotondas (`junction=roundabout|circular`) = sentido único; `oneway` acepta `yes|1|true`.
  - `#bridgeGaps`: cada nodo se une al nodo más cercano de cada tramo vecino (≤ tolerancia) **solo si por carril hay que rodear > `DETOUR_FACTOR` (2) veces el salto**. Aristas de hueco dirigidas. Con datos reales: ~500 huecos a 20 m, ~3.000 a 100 m (por eso el mapa no los dibuja todos, solo los de la ruta).
- `application/BikeRouteService.js` — engancha cada punto al **punto más cercano de hasta 8 tramos** (uno por `wayId`, ≤ `maxSnapDistanceM`) y lanza A* sobre `SnappedGraph` (vista del grafo con nodos temporales `start`/`goal`/`entryK`/`exitK`; **nunca muta la red compartida**). El acceso al carril pesa `accessWeight` (2) veces → prefiere más carril y menos ir fuera de él. Errores tipados: `RouteError` + `RouteErrorCode`. Aristas `EdgeKind`: `lane`, `gap`, `access`.
- `infrastructure/` — repositorios de red con interfaz común `getWays({forceRefresh})` + `lastUpdated()`:
  `StaticFile…` (archivo del despliegue) → `Overpass…` (en vivo + `LocalStorageCache`), encadenados por `Fallback…`.
  `overpassQuery.js` es compartido por navegador y `scripts/fetch-network.js`: cambia la consulta en un solo sitio.
- `ui/MapView.js` — único archivo que conoce Leaflet (`L` global). `ui/RoutePanel.js` — DOM ↔ eventos (`on(event, fn)`).
- `App.js` — estado (origen, destino, red, tolerancia) y coordinación. `main.js` — raíz de composición (DI). `config.js` — ciudad, bbox, URLs, parámetros.

Formato de un tramo (`way`): `{ id, nodes: [osmNodeId…], tags: {…}, geometry: [{lat, lon}…] }` (paralelos `nodes`/`geometry`).
Archivo estático: `data/red-carril-bici.json` = `{ generatedAt, ways }` (ignorado por git; lo genera el despliegue).

## Convenciones

- **Todo en castellano**: UI, comentarios, mensajes de error, commits, nombres de test. Identificadores en inglés.
- Módulos ES nativos, clases con campos privados `#`, sin build ni transpilar. Estilo: 2 espacios, comillas simples, `;`, comas finales.
- Inyección de dependencias por constructor; nada de singletons ni imports de infraestructura desde `domain/`.
- Lógica nueva → en `domain/` o `application/` con test en `tests/*.test.js` (`node:test` + `assert/strict`, helper `way(id, [[nodeId, lat, lon]…], tags)`).
- Texto de usuario con `textContent`, nunca `innerHTML` con datos externos.
- Colores solo como variables CSS en `:root` (con variante oscura); `MapView` las lee con `cssVar()`.

## Trampas conocidas

- **CSP en `<meta>` de `index.html`**: cualquier dominio externo nuevo (API, teselas, CDN) hay que añadirlo a `connect-src`/`img-src`/`script-src` o el navegador lo bloquea en silencio.
- **Overpass desde Node necesita User-Agent propio**: overpass-api.de responde 406 al de por defecto (`node`). `OverpassClient` acepta `userAgent`; `fetch-network.js` envía `carril-bici-albacete/1.0`. Overpass a veces tarda > 3 min o da 429: lanzar la descarga en segundo plano.
- **Nominatim**: máx. 1 petición/s, prohibido autocompletar → solo se busca al pulsar Enter/Buscar.
- **Teselas OSM**: válidas solo para poco tráfico; si crece, cambiar `tiles` en `config.js` + CSP.
- `scripts/build.js` copia una lista blanca (`PUBLIC`); un archivo público nuevo en la raíz hay que añadirlo ahí.
- `fetch-network.js` aborta si hay < 20 tramos (protege de publicar una red vacía).
- `README.md` es para personas: claro y conciso. Detalle técnico para Claude va aquí.

## Estado (actualizar al cambiar)

- Repo: `github.com/josetortosacarcelen/carril-bici-albacete` (público). Pages activado con fuente «GitHub Actions».
- **2026-11-12: la cuenta de GitHub está bloqueada por facturación → Actions no arranca.** Por eso en `deploy.yml` los disparadores `push` y `schedule` están comentados (solo `workflow_dispatch`). Al resolverse: descomentarlos y lanzar un despliegue. Alternativa barajada: Cloudflare Pages (build `npm run build && node scripts/fetch-network.js dist/data/red-carril-bici.json`, salida `dist`).

## Problemas detectados pendientes (por prioridad)

1. `App.#swap()` no intercambia `state.edited`. Reverse geocoding sin limitar a 1/s (clics/arrastres rápidos).
2. «Actualizar datos» con archivo estático presente nunca consulta Overpass; el mensaje dice lo contrario.
3. Google Fonts y Leaflet por CDN externos (RGPD / disponibilidad) → autoalojar.
4. Tests ausentes: `DisjointSet`, `MinHeap`, `SpatialIndex`, `SegmentIndex`, `formatLabel`, `App`.
5. Ideas: peso por tipo de tramo (segregado vs pintado), exportar GPX, aparcabicis.

Al arreglar uno, bórralo de aquí (y añade su test).

## Cómo trabajar aquí (eficiencia)

- El proyecto es pequeño (~2.000 líneas): para preguntas generales lee directamente los archivos; no hacen falta subagentes.
- Antes de dar por bueno un cambio: `npm test`.
- **Cambios en el enrutado: medir con datos reales**, no solo con tests sintéticos. Con `data/red-carril-bici.json` descargado
  (643 tramos en nov. 2026), comparar versión anterior (`git archive HEAD | tar -x -C <scratch>/old`) y nueva sobre ~150 pares
  de puntos aleatorios con semilla fija: rutas encontradas, distancia, ms por ruta y por construcción. Referencia actual:
  construir 20–110 ms, ~1 ms/ruta, 107/150 rutas con tolerancia 20 m.
- Comprobar que un test nuevo falla con el código viejo (mismo truco de `git archive`) antes de darlo por válido. Cambios de UI: `npm start` y comprobar en el navegador.
- Commits pequeños, mensaje en castellano. Nunca `push --force`; el remoto puede tener commits hechos desde la web.
- Responder al usuario en castellano, directo y con prioridades claras.

## Mantenimiento de este archivo

En cada sesión con cambios relevantes, **actualiza este archivo antes de terminar**: estado, problemas resueltos/nuevos,
trampas descubiertas y cualquier atajo que habría ahorrado tiempo. Mantenlo denso: si algo ya no es cierto, bórralo.
