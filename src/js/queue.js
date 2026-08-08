export class ConcurrencyQueue {
  constructor(limit = 8) {
    this.limit = limit;
    this.active = 0;
    this.pending = [];
  }

  run(task) {
    return new Promise((resolve, reject) => {
      this.pending.push({ task, resolve, reject });
      this.#drain();
    });
  }

  #drain() {
    while (this.active < this.limit && this.pending.length > 0) {
      const item = this.pending.shift();
      this.active += 1;

      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          this.active -= 1;
          this.#drain();
        });
    }
  }
}
