/**
 * Contratos de datos compartidos por todas las capas, como tipos JSDoc.
 * No hay código: solo los comprueba `npm run typecheck` (TypeScript sin compilar).
 * Úsalos con  @param {import('../domain/types.js').RouteResult} result
 */

/** @typedef {{ lat: number, lon: number }} LatLon */

/** @typedef {string | number} NodeId */

/**
 * Tramo de OpenStreetMap tal como lo guarda la app (`nodes` y `geometry` son paralelos).
 * @typedef {Object} OsmWay
 * @property {number} id
 * @property {NodeId[]} nodes
 * @property {Record<string, string>} tags
 * @property {(LatLon | null)[]} geometry
 */

/**
 * @typedef {Object} Parking
 * @property {string} id            p. ej. 'node/123'
 * @property {number} lat
 * @property {number} lon
 * @property {number | null} capacity
 * @property {boolean} covered
 * @property {string | null} name
 */

/** @typedef {{ ways: OsmWay[], parkings: Parking[] }} NetworkData */

/**
 * Fuente de la red (archivo estático, Overpass en vivo o una cadena de ellas).
 * @typedef {Object} NetworkRepository
 * @property {(options?: { forceRefresh?: boolean }) => Promise<NetworkData>} getNetwork
 * @property {() => Date | null} lastUpdated
 */

/**
 * Arista del grafo. `weight` es el COSTE que minimiza A* (puede llevar penalización);
 * `lengthM` son los METROS reales: cualquier distancia que se muestre se suma con `lengthM`.
 * @typedef {Object} Edge
 * @property {NodeId} to
 * @property {number} weight
 * @property {number} lengthM
 * @property {string} kind              EdgeKind
 * @property {string | null} [name]     nombre de la calle
 * @property {number} [wayId]
 * @property {string} [laneKind]        LaneKind (solo carril)
 * @property {number} [factor]          penalización por tipo de tramo (solo carril)
 */

/** @typedef {{ laneLengthM: number, segments: number, networks: number }} NetworkStats */

/** @typedef {{ kind: string, points: LatLon[] }} RouteSegment */

/**
 * @typedef {Object} RouteResult
 * @property {RouteSegment[]} segments  tramos consecutivos del mismo tipo (carril o hueco)
 * @property {string[]} streets
 * @property {LatLon} entry             donde se entra al carril
 * @property {LatLon} exit              donde se sale del carril
 * @property {number} laneDistanceM
 * @property {number} gapDistanceM
 * @property {number} paintedDistanceM  parte de laneDistanceM pintada en la calzada
 * @property {number} sharedDistanceM   parte de laneDistanceM compartida con peatones
 * @property {number} accessStartM
 * @property {number} accessEndM
 * @property {number} networkDistanceM  carril + huecos
 */

/**
 * @typedef {Object} Station
 * @property {string} id
 * @property {string} name
 * @property {number} lat
 * @property {number} lon
 * @property {number} freeBikes
 * @property {number} ebikes
 * @property {number} emptySlots
 * @property {boolean} online
 */

/** @typedef {{ station: Station, distanceM: number }} NearbyStation */

/** @typedef {{ pickup: NearbyStation | null, dropoff: NearbyStation | null }} BikeShareSuggestion */

/** Resultado del geocodificador. @typedef {{ label: string, lat: number, lon: number }} Place */

/** @typedef {'origin' | 'destination'} Role */

export {};
