// Prueba de humo de la interfaz en el navegador. NO se ejecuta con Node:
// se pega entero en `javascript_tool` de Claude in Chrome con la app abierta
// (http://localhost:8000, tras ctrl+shift+r). Devuelve un JSON con lo que ve.
// Referencia (nov. 2026): 30 estaciones, ruta 3,11 km, GPX de 245 puntos, sin errores.
const out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const type = (id, text) => { const i = $(id); i.value = text; i.dispatchEvent(new Event('input', { bubbles: true })); };

out.title = document.title;
out.stations = document.querySelectorAll('.station').length;
out.stats = $('#network-stats').textContent;

// Selector Origen/Destino con flechas
const radio = $('[role=radio][data-value=origin]');
radio.focus();
radio.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
out.radio = `${$('[role=radio][aria-checked=true]').dataset.value} (foco: ${document.activeElement.dataset.value})`;
radio.click();

// Combobox: buscar con el botón, la lista se abre y el foco queda en el campo
type('#destination-input', 'Calle Ancha');
$('[data-search=destination]').click();
await wait(2500);
out.suggestions = document.querySelectorAll('#destination-suggestions [role=option]').length;
out.comboFocus = document.activeElement.id;

// Ruta completa con direcciones fijas
$('#clear-btn').click();
type('#origin-input', 'Calle Mayor 10');
type('#destination-input', 'Avenida de España 30');
$('#route-form').requestSubmit();
await wait(4000);
out.total = $('#result-total').textContent;
out.visibleRows = [...document.querySelectorAll('.result__list > div')]
  .filter((d) => getComputedStyle(d).display !== 'none')
  .map((d) => d.querySelector('dt').textContent.trim());
out.bikeShare = $('#result-bikeshare').textContent;

// GPX sin descargar nada al equipo: se intercepta el Blob
let blob = null;
const realCreate = URL.createObjectURL;
const realClick = HTMLAnchorElement.prototype.click;
URL.createObjectURL = (b) => { blob = b; return realCreate(b); };
HTMLAnchorElement.prototype.click = function () { out.gpxFile = this.download; };
$('#gpx-btn').click();
URL.createObjectURL = realCreate;
HTMLAnchorElement.prototype.click = realClick;
out.gpxPoints = blob ? ((await blob.text()).match(/<trkpt /g) ?? []).length : 0;

// Estación como origen
$('.station')?.parentElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
await wait(300);
[...document.querySelectorAll('.station-popup button')].find((b) => b.textContent === 'Salir de aquí')?.click();
out.stationOrigin = $('#origin-input').value;

JSON.stringify(out, null, 1);
