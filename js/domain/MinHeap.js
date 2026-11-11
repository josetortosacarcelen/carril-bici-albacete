/** Cola de prioridad mínima basada en un montículo binario. */
export class MinHeap {
  #items = [];

  get size() {
    return this.#items.length;
  }

  push(priority, value) {
    this.#items.push({ priority, value });
    this.#siftUp(this.#items.length - 1);
  }

  pop() {
    const items = this.#items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      this.#siftDown(0);
    }
    return top;
  }

  #siftUp(i) {
    const items = this.#items;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].priority <= items[i].priority) return;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  #siftDown(i) {
    const items = this.#items;
    const n = items.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && items[left].priority < items[smallest].priority) smallest = left;
      if (right < n && items[right].priority < items[smallest].priority) smallest = right;
      if (smallest === i) return;
      [items[smallest], items[i]] = [items[i], items[smallest]];
      i = smallest;
    }
  }
}
