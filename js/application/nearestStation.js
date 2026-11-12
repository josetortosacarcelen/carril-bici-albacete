import { haversine } from '../domain/geo.js';

/**
 * Estación de bici pública más cercana a un punto que sirva para lo que se
 * necesita: coger una bici ('bikes') o dejarla ('slots').
 * @returns {{ station, distanceM } | null} null si no hay ninguna a menos de maxDistanceM.
 */
export function nearestStation(point, stations, need, maxDistanceM = 1000) {
  let best = null;
  for (const station of stations) {
    if (!station.online) continue;
    if (need === 'bikes' ? station.freeBikes <= 0 : station.emptySlots <= 0) continue;
    const distanceM = haversine(point, station);
    if (distanceM <= maxDistanceM && (!best || distanceM < best.distanceM)) best = { station, distanceM };
  }
  return best;
}
