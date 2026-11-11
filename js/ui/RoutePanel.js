import { formatDistance, formatDuration, formatDate } from './format.js';

const ROLES = ['origin', 'destination'];

/**
 * Panel lateral. Solo traduce eventos del DOM a eventos de la app y pinta
 * lo que le pidan; no contiene lógica de rutas.
 */
export class RoutePanel {
  #el;
  #handlers = {};

  constructor(root) {
    const $ = (sel) => root.querySelector(sel);
    this.#el = {
      root,
      form: $('#route-form'),
      inputs: { origin: $('#origin-input'), destination: $('#destination-input') },
      suggestions: { origin: $('#origin-suggestions'), destination: $('#destination-suggestions') },
      pickButtons: [...root.querySelectorAll('[data-pick]')],
      gapInput: $('#gap-input'),
      gapOutput: $('#gap-output'),
      status: $('#status'),
      result: $('#result'),
      resultTotal: $('#result-total'),
      resultTime: $('#result-time'),
      resultLane: $('#result-lane'),
      resultGapRow: $('#result-gap-row'),
      resultGap: $('#result-gap'),
      resultAccess: $('#result-access'),
      resultStreets: $('#result-streets'),
      resultStreetsRow: $('#result-streets-row'),
      stats: $('#network-stats'),
    };
    this.#bind();
  }

  on(event, handler) {
    this.#handlers[event] = handler;
    return this;
  }

  #emit(event, ...args) {
    this.#handlers[event]?.(...args);
  }

  #bind() {
    const el = this.#el;

    el.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.#emit('submit', {
        origin: el.inputs.origin.value.trim(),
        destination: el.inputs.destination.value.trim(),
      });
    });

    for (const role of ROLES) {
      const input = el.inputs[role];
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.#emit('search', role, input.value.trim());
        } else if (e.key === 'Escape') {
          this.hideSuggestions(role);
        }
      });
      input.addEventListener('input', () => this.#emit('inputEdited', role));
    }

    el.root.querySelectorAll('[data-search]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const role = btn.dataset.search;
        this.#emit('search', role, el.inputs[role].value.trim());
      }),
    );

    el.pickButtons.forEach((btn) =>
      btn.addEventListener('click', () => this.#emit('pickTargetChange', btn.dataset.pick)),
    );

    el.gapInput.addEventListener('input', () => {
      el.gapOutput.value = el.gapInput.value;
    });
    el.gapInput.addEventListener('change', () => this.#emit('gapChange', Number(el.gapInput.value)));

    el.root.querySelector('#swap-btn').addEventListener('click', () => this.#emit('swap'));
    el.root.querySelector('#clear-btn').addEventListener('click', () => this.#emit('clear'));
    el.root.querySelector('#refresh-btn').addEventListener('click', () => this.#emit('refresh'));
  }

  setGapTolerance(value) {
    this.#el.gapInput.value = String(value);
    this.#el.gapOutput.value = String(value);
  }

  setInputValue(role, text) {
    this.#el.inputs[role].value = text;
  }

  getInputValue(role) {
    return this.#el.inputs[role].value.trim();
  }

  setPickTarget(role) {
    for (const btn of this.#el.pickButtons) {
      btn.setAttribute('aria-checked', String(btn.dataset.pick === role));
    }
  }

  showSuggestions(role, places) {
    const list = this.#el.suggestions[role];
    list.replaceChildren();
    if (places.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'suggestions__empty';
      empty.textContent = 'Ninguna dirección coincide dentro de Albacete.';
      list.append(empty);
    }
    for (const place of places) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = place.label;
      button.addEventListener('click', () => {
        this.hideSuggestions(role);
        this.#emit('suggestionPick', role, place);
      });
      item.append(button);
      list.append(item);
    }
    list.hidden = false;
  }

  hideSuggestions(role) {
    this.#el.suggestions[role].hidden = true;
  }

  showStatus(message, tone = 'info') {
    const status = this.#el.status;
    status.textContent = message;
    status.dataset.tone = tone;
    status.hidden = !message;
  }

  showResult(result, speedKmh) {
    const el = this.#el;
    el.resultTotal.textContent = formatDistance(result.networkDistanceM);
    el.resultTime.textContent = `≈ ${formatDuration(result.networkDistanceM, speedKmh)} a ${speedKmh} km/h`;
    el.resultLane.textContent = formatDistance(result.laneDistanceM);
    el.resultGap.textContent = formatDistance(result.gapDistanceM);
    el.resultGapRow.hidden = result.gapDistanceM === 0;
    el.resultAccess.textContent =
      `${formatDistance(result.accessStartM)} al salir · ${formatDistance(result.accessEndM)} al llegar`;
    el.resultStreets.textContent = result.streets.join(' → ');
    el.resultStreetsRow.hidden = result.streets.length === 0;
    el.result.hidden = false;
  }

  hideResult() {
    this.#el.result.hidden = true;
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
