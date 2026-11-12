# CLAUDE.md — Carril Bici Albacete

Web estática (JavaScript sin compilar, sin dependencias de producción) que calcula la ruta más corta por carril bici en
Albacete. Datos de OpenStreetMap (red y aparcabicis), direcciones de Nominatim, AlbaBici en tiempo real (CityBikes), GPX.

## Reglas de trabajo

1. **Castellano** en respuestas, commits, textos de UI, comentarios y tests. Identificadores en inglés.
2. **Al terminar cada tarea**: `npm run check` → commits pequeños en castellano (con la línea de coautoría) → `git push` a `main`.
   Es lo que el usuario espera. Nunca `push --force`: el remoto puede tener commits hechos desde la web.
3. **Verifica según lo que toques** (tabla de abajo) y di qué has comprobado y qué no. Nada de «debería funcionar».
4. **Antes de acabar, actualiza este archivo**: estado, pendientes, trampas y atajos nuevos. README = solo para personas, breve.
5. Proyecto pequeño (~2.600 líneas): lee los archivos directamente; sin subagentes. Para usar Write, antes Read: un `cat`
   no cuenta, y tras editar un archivo con un script hay que volver a leerlo.

## Comandos

| Qué | Comando |
|---|---|
| Tipos + tests (~3 s) — **antes de cada commit** | `npm run check` (la primera vez: `npm ci`) |
| Servir en local | `npm start` → http://localhost:8000 · parar: `pkill -f "http.serve[r] 8000"` |
| Benchmark de enrutado contra otro commit (0,5 s) | `node scripts/bench-routing.js [commit=HEAD] [tolerancia=20]` |
| Descargar red + aparcabicis a `data/` (1–5 min, **en segundo plano**) | `npm run fetch-network` |
| Construir `dist/` (copia + `?v=hash`) | `npm run build` · probar: `cd dist && python3 -m http.server 8001` |
| Desplegar (manual, ver «Estado») | `gh workflow run deploy.yml` y `gh run list -L 1` |

## Verificar según lo que toques

| Cambio | Verificación |
|---|---|
| Cualquier JS | `npm run check`. Un test nuevo debe fallar con el código viejo (`git archive <commit> \| tar -x -C <scratch>/old`). |
| `js/domain/`, `js/application/` (enrutado) | + `node scripts/bench-routing.js <commit anterior>`: rutas encontradas, más cortas/largas, ms. |
| `js/ui/`, `index.html`, `css/` | + Chrome: `npm start`, nueva pestaña, `ctrl+shift+r` (caché de módulos), **pegar `scripts/browser-smoke.js` en `javascript_tool`** y comparar con su referencia. Errores: `read_console_messages` con `onlyErrors`. |
| Datos / consulta Overpass | `npm run fetch-network` en segundo plano; contar tramos y aparcabicis del JSON. |
| `scripts/build.js` | `npm run build` y servir `dist/` en 8001: todos los módulos con el mismo `?v=`. |

Chrome: las capturas están escaladas respecto al CSS (no calcules clics con `getBoundingClientRect`); para poner origen y
destino, rellena los campos y usa `requestSubmit()`, no clics en el mapa. Nunca descargues archivos al equipo: intercepta el Blob.

## Dónde tocar para…

- **Otra ciudad** → `js/config.js` (`city`, `center`, `bbox`, `bikeShare` o `null`) + título y `meta description` de `index.html`. Nada más.
- **Servicio externo nuevo** → clase en `js/infrastructure/`, conectarla en `js/main.js`, dominio en la **CSP** de `index.html`, fila en la tabla del README.
- **Cambiar una forma de datos** → primero `js/domain/types.js`; luego `npm run typecheck` señala todos los usos. Si cambia lo guardado: subir `cacheKey` en `js/config.js` y adaptar `scripts/fetch-network.js` + `StaticFileCyclewayRepository`.
- **Dato nuevo en el resultado de ruta** → `RouteResult` (types.js) → `BikeRouteService.#toResult` (**sumar `lengthM`**) → `ResultView` + fila con `hidden` en `index.html`.
- **Método nuevo del panel o del mapa** → `PanelPort`/`MapPort` en `js/App.js` → fachada (`RoutePanel`/`MapView`) → componente o capa → doble en `tests/app.test.js`.
- **Capa de mapa nueva** → `js/ui/map/XLayer.js` (constructor recibe `map`) + delegación en `MapView` + `MapPort`.
- **Consulta OSM** → `js/infrastructure/overpassQuery.js` (la comparten navegador y despliegue) + `tests/repositories.test.js`.
- **Texto que depende de la ciudad** → `data-text` / `data-label` / `data-requires` en `index.html` (los rellena `js/ui/texts.js`).
- **Color** → variable en `:root` de `css/styles.css` **y** en su variante oscura; en el mapa se lee con `cssVar()`.
- **Actualizar Leaflet** → nueva `dist/` en `vendor/leaflet/`, `openssl dgst -sha256 -binary f | base64`, cambiar `integrity`.

## Arquitectura

`ui → application → domain`; `infrastructure` implementa interfaces; **solo `js/main.js` crea clases concretas** (DI por constructor).

- `domain/` (puro, sin DOM ni red): `types.js` (**contratos `@typedef`**: LatLon, OsmWay, Parking, NetworkData, NetworkRepository, Edge, RouteResult, Station, BikeShareSuggestion, Place, Role), `edges.js` (`EdgeKind`, `LaneKind`), `Graph`, `AStarPathFinder`, `MinHeap`, `DisjointSet`, `SpatialIndex`, `SegmentIndex`, `distancesWithin`, `geo` (`haversine`, `formatCoords`).
- `application/`: `CyclewayGraphBuilder` (`build(ways, { gapToleranceM, preferSegregated })` → `{ graph, segments, gaps, stats }`; `bikeDirection`, `laneKind`, `LANE_COST`, `DETOUR_FACTOR`), `BikeRouteService` (`route(o, d)` → `RouteResult`), `BikeShareService` (`start`, `refresh`, `suggest`), `nearestStation`, `gpx` (`toGpx`, `gpxFilename`).
- `infrastructure/`: repositorios de red `getNetwork({ forceRefresh })` → `{ ways, parkings }` (`StaticFile…` → `Overpass…` + `LocalStorageCache`, encadenados con `Fallback…`), `overpassQuery`, `OverpassClient`, `NominatimGeocoder` (+ `RateLimiter`), `CityBikesStationRepository`.
- `ui/`: fachadas `RoutePanel` (`AddressCombobox` ×2, `RadioGroup`, `ResultView`) y `MapView` (`ui/map/`: `RouteLayer`, `PinLayer`, `StationLayer`, `ParkingLayer`, `helpers`); `texts.js`, `download.js`, `format.js`.
- `App.js`: estado y coordinación; sus dependencias están tipadas (`AppDeps`, `PanelPort`, `MapPort`). `config.js`: ciudad, URLs y parámetros.
- `scripts/`: `build.js` (+ `versioning.js`), `fetch-network.js`, `bench-routing.js`, `browser-smoke.js` (para Chrome, no para Node).

Claves del enrutado: una ruta engancha cada punto al punto más cercano de hasta 8 tramos y lanza A* sobre un `SnappedGraph`
temporal. El acceso al carril pesa ×2. Huecos: un nodo se une al más cercano de cada tramo vecino solo si por carril hay que
rodear más de `DETOUR_FACTOR` (2)× el salto. `preferSegregated` está activado y sin interruptor en la UI: en Albacete hay
69 km separados, 10 compartidos con peatones y 0 pintados, así que apenas cambia rutas.

## Invariantes (no romper)

- `domain/` no importa nada de fuera; `application/` no toca el DOM ni la red.
- **`weight` = coste para A* (lleva penalizaciones); `lengthM` = metros reales.** Toda distancia mostrada suma `lengthM`. tsc no lo vigila: son dos `number`.
- `BikeRouteService` **no muta la red compartida**: los nodos temporales viven en `SnappedGraph`.
- Datos externos al DOM siempre con `textContent`. Nada de terceros al cargar la página salvo teselas OSM y CityBikes (Nominatim solo al buscar).
- Cero dependencias de producción. Única dependencia de desarrollo: `typescript` (versión fijada, solo `--noEmit`).
- La interfaz pública de `RoutePanel` y `MapView` es la de `PanelPort` y `MapPort`: los tests de `App` dependen de ella.

## Trampas

- **CSP en `<meta>`**: un dominio que no esté en la lista se bloquea en silencio. También bloquea `fetch('blob:…')`.
- **`[hidden] { display: none !important }`** en `css/styles.css` es imprescindible: cualquier `display: flex` lo anula.
- **Overpass desde Node** exige User-Agent propio (con el de Node, 406). Da 429/504 a menudo: reintentar.
- **Nominatim**: máximo 1 petición/s y sin autocompletar. **Teselas OSM**: solo poco tráfico.
- `scripts/build.js` publica una lista blanca (`PUBLIC`) y versiona imports con regex: un `import()` con ruta calculada se escaparía.
- tsc comprueba `js/` (estricto, `noImplicitAny: false`), pero **no `scripts/` ni `tests/`**. `L` (Leaflet) es `any`. `querySelector` → `/** @type {HTMLElement} */ (…)`; errores capturados → `unknown`.
- Tests de `App` con estaciones: `t.mock.timers.enable({ apis: ['setInterval'] })` o el proceso no termina.
- `pkill -f "http.server 8000"` sin corchete mata también al propio comando.
- En Albacete hay 22 redes de carril sin conectar: «no se conectan» con ciertas direcciones es un dato real, no un fallo.

## Estado

- Repo `github.com/josetortosacarcelen/carril-bici-albacete` (público). Pages configurado con fuente «GitHub Actions».
- **Desde 2026-11-12 la cuenta de GitHub está bloqueada por facturación: Actions no arranca y la web no está publicada.**
  En `.github/workflows/deploy.yml`, `push` y `schedule` están comentados. Al resolverse: descomentarlos y lanzar un despliegue.
  Alternativa: Cloudflare Pages (build `npm ci && npm run build && node scripts/fetch-network.js dist/data/red-carril-bici.json`, salida `dist`).
- `data/red-carril-bici.json` local: 643 tramos y 237 aparcabicis (12-11-2026). Lo ignora git; lo genera el despliegue.

## Pendiente (por prioridad)

1. Publicar (facturación de GitHub o Cloudflare Pages); recupera también la integración continua.
2. Probar el diseño en móvil (360–400 px).
3. Medir el rendimiento con una ciudad grande (bbox mayor en una copia de `js/config.js` + `scripts/bench-routing.js`); si va lento, precalcular el grafo en el despliegue.
4. Ideas: aparcabicis más cercano al destino; con AlbaBici, ruta de estación a estación.

## Mantenimiento de este archivo

Mantenlo denso y verdadero: lo que deje de ser cierto, se borra. Si repites un trabajo dos veces (un script, una comprobación),
guárdalo en `scripts/` y apúntalo aquí.
