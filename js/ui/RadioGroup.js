/**
 * Grupo de botones role="radio" que se comporta como uno nativo: las flechas
 * cambian la opción (y el foco) y el tabulador tiene un solo punto de parada.
 * Cada botón lleva su valor en data-value.
 */
export class RadioGroup {
  #buttons;

  /** @param onChange (valor) al elegir con clic o con flechas */
  constructor(buttons, onChange) {
    this.#buttons = buttons;
    for (const button of buttons) {
      button.addEventListener('click', () => onChange(button.dataset.value));
      button.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const next = buttons[(buttons.indexOf(button) + step + buttons.length) % buttons.length];
        onChange(next.dataset.value);
        next.focus();
      });
    }
  }

  set value(value) {
    for (const button of this.#buttons) {
      const checked = button.dataset.value === value;
      button.setAttribute('aria-checked', String(checked));
      button.tabIndex = checked ? 0 : -1;
    }
  }
}
