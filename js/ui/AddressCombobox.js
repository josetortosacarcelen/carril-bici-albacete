/**
 * Campo de dirección con sugerencias, accesible (patrón combobox de ARIA):
 * flechas para recorrer, Enter para elegir (o buscar si no hay opción activa),
 * Escape para cerrar. El foco no sale del campo: la opción activa se anuncia
 * con aria-activedescendant.
 */
export class AddressCombobox {
  #input;
  #list;
  #emptyText;
  #handlers;
  #places = [];
  #active = -1;

  /**
   * @param handlers { search(texto), pick(lugar), edited() }
   */
  constructor({ input, list, emptyText }, handlers) {
    this.#input = input;
    this.#list = list;
    this.#emptyText = emptyText;
    this.#handlers = handlers;
    input.addEventListener('keydown', (e) => this.#onKey(e));
    input.addEventListener('input', () => handlers.edited());
    // Las opciones cancelan mousedown, así que perder el foco es salir de verdad.
    input.addEventListener('blur', () => this.hide());
  }

  get value() {
    return this.#input.value.trim();
  }

  set value(text) {
    this.#input.value = text;
  }

  show(places) {
    const list = this.#list;
    list.replaceChildren();
    this.#places = places;
    if (places.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'suggestions__empty';
      empty.setAttribute('role', 'option');
      empty.setAttribute('aria-disabled', 'true');
      empty.textContent = this.#emptyText;
      list.append(empty);
    }
    places.forEach((place, k) => {
      const option = document.createElement('li');
      option.id = `${list.id}-option-${k}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.textContent = place.label;
      option.addEventListener('mousedown', (e) => e.preventDefault()); // no quitar el foco al campo
      option.addEventListener('click', () => this.#pick(place));
      list.append(option);
    });
    list.hidden = false;
    this.#input.setAttribute('aria-expanded', 'true');
    this.#setActive(-1);
    if (document.activeElement !== this.#input) this.#input.focus(); // tras pulsar «Buscar», seguir con flechas
  }

  hide() {
    this.#list.hidden = true;
    this.#input.setAttribute('aria-expanded', 'false');
    this.#input.removeAttribute('aria-activedescendant');
    this.#active = -1;
  }

  #onKey(e) {
    const count = this.#places.length;
    const open = !this.#list.hidden && count > 0;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const current = this.#active;
      this.#setActive(current < 0 ? (step > 0 ? 0 : count - 1) : (current + step + count) % count);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && this.#active >= 0) this.#pick(this.#places[this.#active]);
      else this.#handlers.search(this.value);
    } else if (e.key === 'Escape') {
      this.hide();
    }
  }

  #setActive(index) {
    const options = this.#list.querySelectorAll('[role="option"]');
    this.#active = index;
    options.forEach((option, k) => {
      const active = k === index;
      option.classList.toggle('is-active', active);
      option.setAttribute('aria-selected', String(active));
      if (active) option.scrollIntoView({ block: 'nearest' });
    });
    if (index >= 0) this.#input.setAttribute('aria-activedescendant', options[index].id);
    else this.#input.removeAttribute('aria-activedescendant');
  }

  #pick(place) {
    this.hide();
    this.#handlers.pick(place);
  }
}
