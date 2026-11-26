/** Bound native concurrency without rejecting ordinary bursts of UI changes. */
export class RenderGate {
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(private capacity = 2) {}
  async acquire(signal?: AbortSignal): Promise<() => void> {
    signal?.throwIfAborted();
    if (this.active >= this.capacity) {
      if (this.waiting.length >= 32)
        throw Error('O motor Grace está ocupado. Tente novamente em instantes.');
      await new Promise<void>((resolve, reject) => {
        const ready = () => {
          signal?.removeEventListener('abort', cancel);
          this.active++;
          resolve();
        };
        const cancel = () => {
          const index = this.waiting.indexOf(ready);
          if (index >= 0) this.waiting.splice(index, 1);
          reject(signal?.reason ?? new Error('Renderização cancelada.'));
        };
        this.waiting.push(ready);
        signal?.addEventListener('abort', cancel, { once: true });
      });
    } else this.active++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active--;
      this.waiting.shift()?.();
    };
  }
}
