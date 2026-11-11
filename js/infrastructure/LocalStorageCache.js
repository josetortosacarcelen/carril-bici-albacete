/** Caché con caducidad sobre localStorage. Nunca lanza errores. */
export class LocalStorageCache {
  #key;
  #ttlMs;

  constructor(key, ttlMs) {
    this.#key = key;
    this.#ttlMs = ttlMs;
  }

  get() {
    const entry = this.#read();
    if (!entry || Date.now() - entry.savedAt > this.#ttlMs) return null;
    return entry.data;
  }

  set(data) {
    try {
      localStorage.setItem(this.#key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {
      // Sin espacio o almacenamiento bloqueado: la app funciona igual sin caché.
    }
  }

  savedAt() {
    const entry = this.#read();
    return entry ? new Date(entry.savedAt) : null;
  }

  #read() {
    try {
      const raw = localStorage.getItem(this.#key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
