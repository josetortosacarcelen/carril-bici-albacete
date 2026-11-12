import { formatDistance, formatDate } from './format.js';
import { AddressCombobox } from './AddressCombobox.js';
import { RadioGroup } from './RadioGroup.js';
import { ResultView } from './ResultView.js';

const ROLES = ['origin', 'destination'];

/**
 * Panel lateral: compone los controles y traduce sus eventos en eventos de la
 * app (`on(evento, fn)`); pinta lo que le pidan. No contiene lógica de rutas.
 */
export class RoutePanel {
  #el;
  #handlers = {};
  #addresses;
  #pickTarget;
  #result;

  /**
   * @param {HTMLElement} root
   * @param {{ city: string }} options city: para los mensajes («…dentro de Albacete»)
   */
  constructor(root, { city }) {
    const $ = (/** @type {string} */ sel) => /** @type {any} */ (root.querySelector(sel));
    /** @type {(sel: string) => HTMLElement[]} */
    const $$ = (sel) => [...root.querySelectorAll(sel)].map((e) => /** @type {HTMLElement} */ (e));
    this.#el = { status: $('#status'), stats: $('#network-stats'), gapInput: $('#gap-input'), gapOutput: $('#gap-output') };

    this.#addresses = Object.fromEntries(ROLES.map((role) => [role, new AddressCombobox(
      { input: $(`#${role}-input`), list: $(`#${role}-suggestions`), emptyText: `Ninguna dirección coincide dentro de ${city}.` },
      {
        search: (text) => this.#emit('search', role, text),
        pick: (place) => this.#emit('suggestionPick', role, place),
        edited: () => this.#emit('inputEdited', role),
      },
    )]));
    this.#pickTarget = new RadioGroup($$('[data-value][role="radio"]'),
      (role) => this.#emit('pickTargetChange', role));
    this.#result = new ResultView($('#result'), { onDownloadGpx: () => this.#emit('downloadGpx') });

    $('#route-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.#emit('submit');
    });
    for (const btn of $$('[data-search]')) {
      const role = /** @type {'origin' | 'destination'} */ (btn.dataset.search);
      btn.addEventListener('click', () => this.#emit('search', role, this.#addresses[role].value));
    }
    this.#el.gapInput.addEventListener('input', () => { this.#el.gapOutput.value = this.#el.gapInput.value; });
    this.#el.gapInput.addEventListener('change', () => this.#emit('gapChange', Number(this.#el.gapInput.value)));
    for (const [id, event] of [['#swap-btn', 'swap'], ['#clear-btn', 'clear'], ['#refresh-btn', 'refresh']]) {
      $(id).addEventListener('click', () => this.#emit(event));
    }
  }

  on(event, handler) {
    this.#handlers[event] = handler;
    return this;
  }

  #emit(event, ...args) {
    this.#handlers[event]?.(...args);
  }

  setGapTolerance(value) {
    this.#el.gapInput.value = String(value);
    this.#el.gapOutput.value = String(value);
  }

  setInputValue(role, text) {
    this.#addresses[role].value = text;
  }

  getInputValue(role) {
    return this.#addresses[role].value;
  }

  setPickTarget(role) {
    this.#pickTarget.value = role;
  }

  showSuggestions(role, places) {
    this.#addresses[role].show(places);
  }

  hideSuggestions(role) {
    this.#addresses[role].hide();
  }

  showStatus(message, tone = 'info') {
    const { status } = this.#el;
    status.textContent = message;
    status.dataset.tone = tone;
    status.hidden = !message;
  }

  showResult(result, speedKmh) {
    this.#result.show(result, speedKmh);
  }

  showBikeShare(info) {
    this.#result.showBikeShare(info);
  }

  hideResult() {
    this.#result.hide();
  }

  showNetworkStats(stats, updatedAt) {
    const parts = [
      `${formatDistance(stats.laneLengthM)} de carril`,
      `${stats.segments} tramos`,
      stats.networks === 1 ? '1 red conectada' : `${stats.networks} redes sin conectar`,
    ];
    if (updatedAt) parts.push(`datos del ${formatDate(updatedAt)}`);
    this.#el.stats.textContent = parts.join(' · ');
  }
}
