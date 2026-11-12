/** Utilidades compartidas por las capas del mapa. */

/** Color de una variable CSS (respeta el modo oscuro). */
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** { lat, lon } → [lat, lng] de Leaflet. */
export const toLatLng = (p) => [p.lat, p.lon];

/** Crea un elemento con clase y texto (siempre textContent: puede ser un dato externo). */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
