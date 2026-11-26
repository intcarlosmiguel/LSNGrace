/** Small byte-bounded LRU; entries larger than the budget are never retained. */
export class BudgetCache<K, V> {
  private entries = new Map<K, { value: V; bytes: number }>();
  private bytes = 0;
  constructor(
    private budget: number,
    private limit = 8,
    private dispose?: (value: V) => void,
  ) {}
  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key: K, value: V, bytes: number): boolean {
    if (bytes > this.budget) return false;
    this.remove(key);
    this.entries.set(key, { value, bytes });
    this.bytes += bytes;
    while (this.bytes > this.budget || this.entries.size > this.limit)
      this.remove(this.entries.keys().next().value!);
    return true;
  }
  private remove(key: K) {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.bytes -= entry.bytes;
    this.entries.delete(key);
    this.dispose?.(entry.value);
  }
  clear() {
    for (const key of this.entries.keys()) this.remove(key);
  }
}
