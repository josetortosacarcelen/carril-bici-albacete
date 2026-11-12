/** Error con el que se rechaza una tarea sustituida por otra más reciente. */
export class SupersededError extends Error {
  constructor() {
    super('sustituida por una petición más reciente');
    this.name = 'SupersededError';
  }
}

/**
 * Ejecuta tareas asíncronas en orden, separando el inicio de cada una al
 * menos intervalMs (p. ej. Nominatim: una petición por segundo).
 * Si llega una tarea con la misma `key` que otra que aún espera turno, la
 * vieja se descarta: al arrastrar un marcador solo importa la última posición.
 */
export class RateLimiter {
  #intervalMs;
  #queue = [];
  #nextStart = 0;
  #running = false;

  constructor(intervalMs) {
    this.#intervalMs = intervalMs;
  }

  /**
   * @template T
   * @param {() => T | Promise<T>} task
   * @param {{ key?: string | null }} [options]
   * @returns {Promise<T>}
   */
  schedule(task, { key = null } = {}) {
    return new Promise((resolve, reject) => {
      if (key !== null) {
        const waiting = this.#queue.findIndex((job) => job.key === key);
        if (waiting >= 0) this.#queue.splice(waiting, 1)[0].reject(new SupersededError());
      }
      this.#queue.push({ task, key, resolve, reject });
      this.#pump();
    });
  }

  async #pump() {
    if (this.#running) return;
    this.#running = true;
    while (this.#queue.length > 0) {
      const delay = this.#nextStart - Date.now();
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      const job = this.#queue.shift();
      if (!job) break;
      this.#nextStart = Date.now() + this.#intervalMs;
      Promise.resolve().then(job.task).then(job.resolve, job.reject);
    }
    this.#running = false;
  }
}
