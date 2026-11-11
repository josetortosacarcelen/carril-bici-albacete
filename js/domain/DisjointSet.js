/** Union-Find con compresión de caminos y unión por tamaño. */
export class DisjointSet {
  #parent = new Map();
  #size = new Map();
  #count = 0;

  add(id) {
    if (this.#parent.has(id)) return;
    this.#parent.set(id, id);
    this.#size.set(id, 1);
    this.#count += 1;
  }

  find(id) {
    let root = id;
    while (this.#parent.get(root) !== root) root = this.#parent.get(root);
    while (this.#parent.get(id) !== root) {
      const next = this.#parent.get(id);
      this.#parent.set(id, root);
      id = next;
    }
    return root;
  }

  /** Une los conjuntos de a y b. Devuelve false si ya estaban unidos. */
  union(a, b) {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return false;
    if (this.#size.get(ra) < this.#size.get(rb)) [ra, rb] = [rb, ra];
    this.#parent.set(rb, ra);
    this.#size.set(ra, this.#size.get(ra) + this.#size.get(rb));
    this.#count -= 1;
    return true;
  }

  get count() {
    return this.#count;
  }
}
