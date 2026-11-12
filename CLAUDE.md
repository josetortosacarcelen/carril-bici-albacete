# CLAUDE.md — Carril Bici Albacete

Web estática que calcula la ruta más corta entre dos puntos de Albacete **usando solo carril bici**.
Red y aparcabicis de OpenStreetMap (Overpass), direcciones con Nominatim, mapa Leaflet, ruta con A*,
estaciones AlbaBici en tiempo real (CityBikes), exportación GPX.

## Comandos

| Qué | Comando |
|---|---|
| **Comprobar todo antes de commit** (tipos + tests, ~3 s) | `npm run check` |
| Solo tests (Node, sin navegador, ~0,3 s) / solo tipos | `npm test` / `npm run typecheck` |
| Servir en local | `npm start` → http://localhost:8000 (no `0.0.0.0`) |
| Descargar red + aparcabicis a `data/` | `npm run fetch-network` (Overpass: 1–5 min, lanzar en segundo plano) |
| Construir `dist/` (copia + versionado `?v=hash`) | `npm run build` |
| Desplegar (solo manual, ver «Estado») | `gh workflow run deploy.yml` y `gh run list -L 1` |

**Cero dependencias en producción.** Única dependencia de desarrollo: `typescript` 5.9.3 fijada (solo `tsc --noEmit`; `npm ci` una vez).
El código sigue siendo JavaScript sin compilar; los tipos van en JSDoc. Node ≥ 18. Nada de terceros al abrir la web salvo teselas OSM y CityBikes
(y Nominatim al buscar): Leaflet 1.9.4 en `vendor/leaflet/` (SRI en `index.html`) y fuentes Barlow woff2 (OFL) en `fonts/`.
Actualizar Leaflet: bajar la `dist/` nueva, `openssl dgst -sha256 -binary f | base64`, cambiar `integrity`.

## Mapa del código (`js/` + `scripts/` ≈ 2.550 líneas; tests ≈ 660)

Dependencias solo hacia dentro: `ui → application → domain`; `infrastructure` implementa interfaces; todo se conecta en `main.js`.

- **`domain/types.js` — contratos como `@typedef`** (LatLon, OsmWay, Parking, NetworkData, NetworkRepository, Edge, RouteResult, Station, BikeShareSuggestion, Place, Role). Úsalos con `@param {import('…/domain/types.js').X}`; si cambias una forma de datos, cámbiala aquí primero.
- `domain/edges.js` — `EdgeKind` (lane/gap/access) y `LaneKind`. `domain/geo.js` — `haversine`, `formatCoords`.
- `domain/` (puro): `Graph`, `AStarPathFinder`, `MinHeap`, `DisjointSet`, `SpatialIndex` (nodos), `SegmentIndex` (+ `projectOnSegment`), `distancesWithin(graph, id, max, cost?)`.
- `application/CyclewayGraphBuilder.js` — `build(ways, { gapToleranceM, preferSegregated })` → `{ graph, segments, gaps, stats }`.
  - Arista de carril: `{ to, weight, kind:'lane', wayId, name, laneKind, factor, lengthM }`. **`weight` = coste (longitud × `factor`); `lengthM` = metros reales.** Cualquier suma de distancias usa `lengthM`.
  - `bikeDirection(tags)` → 1/-1/0 (rotondas = sentido único; `oneway` yes|1|true).
  - `laneKind(tags)` → `segregated` | `painted` | `shared`; `LANE_COST` = 1 / 1,3 / 1,15 si `preferSegregated` (activado en `config.js`, **sin interruptor en la UI**: en Albacete hay 69 km separados, 10 compartidos con peatones y 0 pintados; solo cambia 1 de 107 rutas).
  - `#bridgeGaps`: une cada nodo con el más cercano de cada tramo vecino (≤ tolerancia) solo si por carril hay que rodear > `DETOUR_FACTOR` (2)× el salto. Aristas dirigidas. ~500 huecos a 20 m (el mapa solo dibuja los de la ruta).
- `application/BikeRouteService.js` — engancha cada punto al punto más cercano de hasta 8 tramos y lanza A* sobre `SnappedGraph` (vista con nodos temporales; **no muta la red**). Acceso al carril × `accessWeight` (2). Resultado: `{ segments, streets, entry, exit, laneDistanceM, gapDistanceM, paintedDistanceM, sharedDistanceM, accessStartM, accessEndM, networkDistanceM }`.
- `application/BikeShareService.js` — `start(onChange)` (carga + refresco), `refresh()`, `suggest(origen, destino)` (usa `nearestStation`: `'bikes'`/`'slots'`, ≤ 1 km). Conserva las últimas estaciones si el servicio falla.
- `application/gpx.js` — `toGpx({ …, creator })`, `gpxFilename(fecha)`.
- `infrastructure/` — repositorios de red: **`getNetwork({ forceRefresh })` → `{ ways, parkings }`** + `lastUpdated()`.
  `StaticFile…` → `Overpass…` (+ `LocalStorageCache`, clave `…:red:v2`; súbela si cambia el formato) encadenados por `Fallback…`.
  `overpassQuery.js` (`buildCyclewayQuery`, `toWays`, `toParkings`) lo comparten navegador y `scripts/fetch-network.js`.
  `CityBikesStationRepository` (`getStations()`). `NominatimGeocoder` pasa todo por `RateLimiter` (1,1 s; `key` sustituye la petición en espera).
- `ui/MapView.js` — **fachada** (único punto de entrada a Leaflet para la app): crea el mapa, pinta la red y delega en `ui/map/`:
  `RouteLayer`, `PinLayer` (A/B arrastrables), `StationLayer` (actualiza en el sitio), `ParkingLayer` (zoom ≥ 15); `helpers.js` (`cssVar`, `toLatLng`, `el`).
- `ui/RoutePanel.js` — **fachada** del panel (`on(evento, fn)` + métodos de `PanelPort`), compone `AddressCombobox` (×2, combobox ARIA),
  `RadioGroup` (Origen/Destino, `data-value`) y `ResultView` (tarjeta del resultado + GPX).
- `ui/texts.js` — `applyConfigTexts`: rellena `data-text` / `data-label` / `data-requires` de `index.html` desde `config.js`.
- `ui/download.js` — `download(nombre, texto, tipo)` con Blob; se inyecta en `App` (en tests, un doble).
- `App.js` — estado y coordinación. **Sus dependencias están tipadas como puertos** (`PanelPort`, `MapPort`, `AppDeps` al principio
  del archivo): un método nuevo del panel o del mapa se declara ahí. `config.js` — ciudad, bbox, URLs, parámetros: **cambiar de
  ciudad = editar `config.js`** (+ título/descripción por defecto de `index.html` para buscadores).

Archivo estático `data/red-carril-bici.json` = `{ generatedAt, ways, parkings }` (ignorado por git; lo genera el despliegue).
Tramo: `{ id, nodes, tags, geometry }` (`nodes`/`geometry` paralelos). Aparcabicis: `{ id, lat, lon, capacity, covered, name }`.

## Convenciones

- **Todo en castellano** (UI, comentarios, errores, commits, tests); identificadores en inglés.
- Módulos ES nativos, campos privados `#`, sin transpilar. 2 espacios, comillas simples, `;`, comas finales.
- DI por constructor; nada de infraestructura en `domain/`. Texto externo siempre con `textContent`.
- Colores solo como variables CSS en `:root` con variante oscura; `MapView` los lee con `cssVar()`.
- Tests en `tests/*.test.js` (`node:test`): `routing` (helper `way(id, [[nodo, lat, lon]…], tags)`), `domain`, `features`,
  `repositories`, `rateLimiter`, `versioning`, `app` (`setup({ repository, stationRepository, builder })` con dobles; los tests no se comprueban con tsc;
  `panel.emit(evento)`, `mapView.click(punto)`, `downloads`; con estaciones, `t.mock.timers.enable({ apis: ['setInterval'] })`).

## Trampas conocidas

- **CSP en `<meta>` de `index.html`**: dominio externo nuevo → añadirlo a `connect-src`/`img-src` o se bloquea en silencio. También bloquea `fetch('blob:…')`.
- **`[hidden]` necesita `display: none !important`** (ya en `styles.css`): si no, cualquier `display: flex` lo anula y se ven filas vacías.
- **Overpass desde Node**: User-Agent propio obligatorio (406 con el de Node). A veces 429/504: reintentar.
- **Nominatim**: máx. 1 petición/s, sin autocompletar. **Teselas OSM**: solo poco tráfico.
- `scripts/build.js`: lista blanca `PUBLIC`; los imports relativos se versionan con regex (`scripts/versioning.js`): un import dinámico con ruta calculada no se versionaría.
- `fetch-network.js` aborta con < 20 tramos.
- **tsc no distingue `weight` de `lengthM`** (ambos `number`): las sumas de distancias se revisan a mano.
- `tsconfig.json` comprueba `js/` (estricto, `noImplicitAny: false`); `scripts/` y `tests/` no (necesitarían `@types/node`). `L` (Leaflet) es `any` (`types/globals.d.ts`).
- `querySelector` devuelve `Element | null`: en ui/ se convierte con `/** @type {HTMLElement} */ (…)`; los errores capturados son `unknown` (en App, `messageOf(error)`).
- `README.md` es para personas: claro y conciso. El detalle técnico va aquí.

## Estado (actualizar al cambiar)

- Repo `github.com/josetortosacarcelen/carril-bici-albacete` (público), Pages con fuente «GitHub Actions».
- **Desde 2026-11-12 la cuenta de GitHub está bloqueada por facturación → Actions no arranca; la web no está publicada.**
  En `deploy.yml`, `push` y `schedule` comentados (solo `workflow_dispatch`). Al resolverse: descomentar y desplegar.
  Alternativa: Cloudflare Pages (build `npm run build && node scripts/fetch-network.js dist/data/red-carril-bici.json`, salida `dist`).

## Pendiente / ideas (por prioridad)

1. Publicar (depende de la facturación de GitHub o de pasar a Cloudflare Pages).
2. Revisar el diseño en móvil (no se ha probado a 360–400 px con el panel, que ahora es más largo).
3. Ideas: aparcabicis más cercano al destino en el resultado; con AlbaBici, ruta de estación a estación.

## Cómo trabajar aquí (eficiencia)

- Proyecto pequeño: leer los archivos directamente; no hacen falta subagentes.
- Siempre `npm run check`. Para probar que tsc vigila algo, introducir el fallo a propósito, ejecutar y restaurar. Un test nuevo debe fallar con el código viejo (`git archive <commit> | tar -x -C <scratch>/old`).
- **Enrutado: medir con datos reales** (~150 pares aleatorios con semilla fija, versión vieja frente a nueva). Referencia
  (nov. 2026, 643 tramos): construir 20–110 ms, ~1 ms/ruta, 107/150 rutas con tolerancia 20 m.
- **Probar en Chrome**: `ctrl+shift+r` (caché de módulos). Las capturas están escaladas respecto al CSS: hacer clic con
  coordenadas de la captura o desde `javascript_tool`; **para poner origen/destino, rellenar los campos y `requestSubmit()`**
  (los clics en el mapa dependen del encuadre). Descargas: interceptar `URL.createObjectURL` y `HTMLAnchorElement.prototype.click`
  (no descargar archivos al equipo del usuario). Probar también `dist/` servido aparte (`cd dist && python3 -m http.server 8001`).
- Antes de editar un archivo con Write, leerlo con Read (un `cat` por Bash no cuenta).
- Parar servidores: `pkill -f "http.serve[r] 8000"` (el corchete evita que pkill se mate a sí mismo).
- Commits pequeños en castellano; nunca `push --force`. Responder en castellano, directo, con prioridades.

## Mantenimiento de este archivo

En cada sesión con cambios relevantes, **actualízalo antes de terminar**: estado, pendientes, trampas nuevas y atajos que
habrían ahorrado tiempo. Mantenlo denso: lo que ya no sea cierto, se borra.
