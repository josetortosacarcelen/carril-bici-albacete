/**
 * Rellena los textos de index.html que dependen de la configuración, para que
 * cambiar de ciudad o de servicio de bici pública sea editar solo config.js.
 *  - data-text="city" | "bikeShare"  → textContent
 *  - data-label="…{city}…"           → aria-label con la plantilla rellenada
 *  - data-requires="bikeShare"       → se quita si no hay bici pública configurada
 * El HTML lleva los textos de Albacete por defecto (buscadores, sin JavaScript).
 */
export function applyConfigTexts(document, config) {
  const values = { city: config.city, bikeShare: config.bikeShare?.name ?? '' };
  const fill = (template) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');

  document.title = `Carril Bici ${config.city}`;
  for (const el of document.querySelectorAll('[data-text]')) el.textContent = values[el.dataset.text] ?? '';
  for (const el of document.querySelectorAll('[data-label]')) el.setAttribute('aria-label', fill(el.dataset.label));
  if (!config.bikeShare) {
    for (const el of document.querySelectorAll('[data-requires="bikeShare"]')) el.remove();
  }
}
