# Carril Bici Albacete

Web app que calcula la ruta más corta entre dos direcciones de Albacete **circulando solo por carril bici**.

## En local

Usa módulos ES, así que hay que servirla (abrir `index.html` con doble clic no funciona):

```bash
npm run fetch-network   # opcional: descarga la red a data/ (si no, la app tira de Overpass en vivo)
npm start               # python3 -m http.server 8000
```

Abre <http://localhost:8000> (mejor `localhost` que `0.0.0.0`: algunos servidores de mapas rechazan esa dirección).

Tests (sin navegador): `npm test`.

## Producción: GitHub Pages

El despliegue está automatizado en `.github/workflows/deploy.yml`:

1. Pasa los tests.
2. Copia a `dist/` solo lo que se publica (`npm run build`).
3. Descarga la red de carril bici de OpenStreetMap a `dist/data/red-carril-bici.json`.
4. Publica `dist/` en GitHub Pages.

Se ejecuta en cada push a `main` y cada lunes de madrugada, para recoger cambios en el mapa. Si algo falla (tests rotos, Overpass caído, red sospechosamente pequeña), no se publica y sigue en línea la versión anterior.

### Puesta en marcha (una sola vez)

```bash
cd carril-bici-albacete
git init -b main
git add .
git commit -m "Primera versión"
gh repo create carril-bici-albacete --public --source . --push   # o créalo en github.com y haz git push
```

En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. El primer despliegue sale en la pestaña **Actions**, y la URL queda como `https://<tu-usuario>.github.io/carril-bici-albacete/`.

Para lanzar un despliegue a mano: **Actions → Desplegar → Run workflow**.

### Dominio propio (opcional)

En **Settings → Pages → Custom domain** pon, por ejemplo, `bici.tudominio.es`. En tu DNS (Cloudflare u otro) crea un `CNAME` de `bici` a `<tu-usuario>.github.io`. Marca **Enforce HTTPS** cuando aparezca.

## Qué hace en producción

- **Red de carril bici**: se sirve como archivo estático junto a la web, así que no depende de que Overpass responda cuando alguien la abre. Si el archivo faltara, la app recurre a Overpass en vivo (tres servidores, lista en `config.js`).
- **Direcciones**: Nominatim (OpenStreetMap), limitado a Albacete. Su política permite como máximo una petición por segundo y no permite autocompletar, por eso se busca al pulsar Enter.
- **Mapa base**: teselas de OpenStreetMap. Su política de uso vale para tráfico pequeño. Si la app se hace popular, cambia `tiles` en `config.js` por un proveedor con plan gratuito y clave (MapTiler, Stadia Maps…) y añade su dominio a `img-src` en la CSP de `index.html`.
- **Seguridad**: Content-Security-Policy restrictiva en `index.html` (solo los dominios que usa la app) y Leaflet cargado con integridad SRI. Si añades un servicio externo, añádelo también a la CSP o el navegador lo bloqueará.

## Cómo se usa

1. Escribe una dirección y pulsa **Enter** o **Buscar**, o pulsa directamente en el mapa (A = origen, B = destino).
2. La ruta se calcula sola en cuanto hay dos puntos. Los marcadores se pueden arrastrar.
3. **Unir huecos**: en OpenStreetMap los carriles suelen cortarse en los cruces. Con 0 m solo se usan tramos de carril. Con 20 m (por defecto) se permiten saltos cortos, que se dibujan en naranja y se suman aparte.

El PDF municipal es de marzo de 2011 y es una imagen, sin geometría con la que calcular. Si ves un carril que falta o está mal, corrígelo en openstreetmap.org y la app lo recogerá en el siguiente despliegue semanal.

## Arquitectura

```
js/
  domain/          Lógica pura, sin navegador ni red
    Graph.js, AStarPathFinder.js, MinHeap.js, DisjointSet.js, SpatialIndex.js, geo.js
  application/     Casos de uso
    CyclewayGraphBuilder.js  tramos OSM → grafo (sentidos únicos, unión de huecos)
    BikeRouteService.js      engancha direcciones a la red y calcula la ruta
  infrastructure/  Servicios externos
    StaticFileCyclewayRepository.js   red generada en el despliegue
    OverpassCyclewayRepository.js     red en vivo + caché local
    FallbackCyclewayRepository.js     prueba repositorios en orden
    OverpassClient.js, overpassQuery.js  compartidos con scripts/fetch-network.js
    NominatimGeocoder.js, LocalStorageCache.js
  ui/              Presentación
    MapView.js (único archivo que conoce Leaflet), RoutePanel.js, format.js
  App.js           Controlador: estado y coordinación
  main.js          Raíz de composición (inyección de dependencias)
  config.js        Ciudad, bbox, URLs y parámetros
scripts/           build.js y fetch-network.js (Node, se usan en el despliegue)
tests/             node --test
```

- Todos los repositorios de red tienen la misma interfaz (`getWays()`, `lastUpdated()`), así que se combinan o se sustituyen sin tocar la app.
- La consulta a Overpass vive en un único módulo que comparten el navegador y el script de build.
- Para otra ciudad basta con editar `config.js`.

## Ideas para seguir

- Preferir carril segregado frente a carril pintado (peso por tipo de tramo).
- Exportar la ruta a GPX.
- Mostrar los aparcabicis (`amenity=bicycle_parking`).
