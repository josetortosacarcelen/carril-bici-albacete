// Raíz de composición: aquí se crean y se conectan todas las piezas.
import { CONFIG } from './config.js';
import { App } from './App.js';
import { AStarPathFinder } from './domain/AStarPathFinder.js';
import { CyclewayGraphBuilder } from './application/CyclewayGraphBuilder.js';
import { BikeRouteService } from './application/BikeRouteService.js';
import { BikeShareService } from './application/BikeShareService.js';
import { LocalStorageCache } from './infrastructure/LocalStorageCache.js';
import { OverpassClient } from './infrastructure/OverpassClient.js';
import { OverpassCyclewayRepository } from './infrastructure/OverpassCyclewayRepository.js';
import { StaticFileCyclewayRepository } from './infrastructure/StaticFileCyclewayRepository.js';
import { FallbackCyclewayRepository } from './infrastructure/FallbackCyclewayRepository.js';
import { CityBikesStationRepository } from './infrastructure/CityBikesStationRepository.js';
import { NominatimGeocoder } from './infrastructure/NominatimGeocoder.js';
import { MapView } from './ui/MapView.js';
import { RoutePanel } from './ui/RoutePanel.js';
import { download } from './ui/download.js';
import { applyConfigTexts } from './ui/texts.js';

applyConfigTexts(document, CONFIG);

// Primero el archivo generado en el despliegue; si no existe (p. ej. en
// local antes de ejecutar `npm run fetch-network`), Overpass en vivo.
const repository = new FallbackCyclewayRepository([
  new StaticFileCyclewayRepository({ url: CONFIG.staticNetworkUrl }),
  new OverpassCyclewayRepository({
    client: new OverpassClient({ endpoints: CONFIG.overpassUrls, timeoutMs: CONFIG.overpassTimeoutMs }),
    bbox: CONFIG.bbox,
    cache: new LocalStorageCache(CONFIG.cacheKey, CONFIG.cacheTtlMs),
  }),
]);

const app = new App({
  config: CONFIG,
  repository,
  bikeShare: CONFIG.bikeShare
    ? new BikeShareService({
      repository: new CityBikesStationRepository({ url: CONFIG.bikeShare.url }),
      refreshMs: CONFIG.bikeShare.refreshMs,
    })
    : null,
  graphBuilder: new CyclewayGraphBuilder(),
  routeService: new BikeRouteService({
    pathFinder: new AStarPathFinder(),
    maxSnapDistanceM: CONFIG.maxSnapDistanceM,
  }),
  geocoder: new NominatimGeocoder({
    searchUrl: CONFIG.nominatimSearchUrl,
    reverseUrl: CONFIG.nominatimReverseUrl,
    city: CONFIG.city,
    bbox: CONFIG.bbox,
  }),
  mapView: new MapView('map', { center: CONFIG.center, zoom: CONFIG.zoom, tiles: CONFIG.tiles }),
  panel: new RoutePanel(document.querySelector('.panel'), { city: CONFIG.city }),
  download,
});

app.start();
