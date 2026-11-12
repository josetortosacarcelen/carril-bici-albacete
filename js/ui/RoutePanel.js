import { formatDistance, formatDuration, formatDate } from './format.js';

const ROLES = ['origin', 'destination'];

/**
 * Panel lateral. Solo traduce eventos del DOM a eventos de la app y pinta
 * lo que le pidan; no contiene lógica de rutas.
 */
export class RoutePanel {
  #el;
  #handlers = {};
  #places = { origin: [], destination: [] };
  #active = { origin: -1, destination: -1 };

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
      input.addEventListener('keydown', (e) => this.#onInputKey(role, e));
      input.addEventListener('input', () => this.#emit('inputEdited', role));
      // Las opciones cancelan mousedown, así que perder el foco es salir de verdad.
      input.addEventListener('blur', () => this.hideSuggestions(role));
    }

    el.root.querySelectorAll('[data-search]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const role = btn.dataset.search;
        this.#emit('search', role, el.inputs[role].value.trim());
      }),
    );

    el.pickButtons.forEach((btn) => {
      btn.addEventListener('click', () => this.#emit('pickTargetChange', btn.dataset.pick));
      btn.addEventListener('keydown', (e) => this.#onPickKey(e));
    });

    el.gapInput.addEventListener('input', () => {
      el.gapOutput.value = el.gapInput.value;
    });
    el.gapInput.addEventListener('change', () => this.#emit('gapChange', Number(el.gapInput.value)));

    el.root.querySelector('#swap-btn').addEventListener('click', () => this.#emit('swap'));
    el.root.querySelector('#clear-btn').addEventListener('click', () => this.#emit('clear'));
    el.root.querySelector('#refresh-btn').addEventListener('click', () => this.#emit('refresh'));
  }

  /** Combobox: flechas para moverse por las sugerencias, Enter para elegir o buscar. */
  #onInputKey(role, e) {
    const open = !this.#el.suggestions[role].hidden && this.#places[role].length > 0;
    const count = this.#places[role].length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const current = this.#active[role];
      const next = current < 0 ? (step > 0 ? 0 : count - 1) : (current + step + count) % count;
      this.#setActive(role, next);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && this.#active[role] >= 0) this.#pick(role, this.#places[role][this.#active[role]]);
      else this.#emit('search', role, e.target.value.trim());
    } else if (e.key === 'Escape') {
      this.hideSuggestions(role);
    }
  }

  /** Grupo de radio: las flechas cambian la opción (y el foco), como uno nativo. */
  #onPickKey(e) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const buttons = this.#el.pickButtons;
    const next = buttons[(buttons.indexOf(e.currentTarget) + step + buttons.length) % buttons.length];
    this.#emit('pickTargetChange', next.dataset.pick);
    next.focus();
  }

  #setActive(role, index) {
    const input = this.#el.inputs[role];
    const options = this.#el.suggestions[role].querySelectorAll('[role="option"]');
    this.#active[role] = index;
    options.forEach((option, k) => {
      const active = k === index;
      option.classList.toggle('is-active', active);
      option.setAttribute('aria-selected', String(active));
      if (active) option.scrollIntoView({ block: 'nearest' });
    });
    if (index >= 0) input.setAttribute('aria-activedescendant', options[index].id);
    else input.removeAttribute('aria-activedescendant');
  }

  #pick(role, place) {
    this.hideSuggestions(role);
    this.#emit('suggestionPick', role, place);
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
      const checked = btn.dataset.pick === role;
      btn.setAttribute('aria-checked', String(checked));
      btn.tabIndex = checked ? 0 : -1; // tabulador: un solo punto de parada en el grupo
    }
  }

  showSuggestions(role, places) {
    const list = this.#el.suggestions[role];
    const input = this.#el.inputs[role];
    list.replaceChildren();
    this.#places[role] = places;
    if (places.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'suggestions__empty';
      empty.setAttribute('role', 'option');
      empty.setAttribute('aria-disabled', 'true');
      empty.textContent = 'Ninguna dirección coincide dentro de Albacete.';
      list.append(empty);
    }
    places.forEach((place, k) => {
      const option = document.createElement('li');
      option.id = `${role}-option-${k}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.textContent = place.label;
      option.addEventListener('mousedown', (e) => e.preventDefault()); // no quitar el foco al campo
      option.addEventListener('click', () => this.#pick(role, place));
      list.append(option);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    this.#setActive(role, -1);
    if (document.activeElement !== input) input.focus(); // tras pulsar «Buscar», seguir con flechas
  }

  hideSuggestions(role) {
    this.#el.suggestions[role].hidden = true;
    this.#el.inputs[role].setAttribute('aria-expanded', 'false');
    this.#el.inputs[role].removeAttribute('aria-activedescendant');
    this.#active[role] = -1;
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
