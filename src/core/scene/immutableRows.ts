// Only deeply frozen arrays can be cached safely. Mutable parser/API inputs
// must still be checked on every call, even when their identity is unchanged.
const immutable = new WeakSet<number[][]>();
export function immutableRows(rows: number[][]): boolean {
  if (immutable.has(rows)) return true;
  if (!Object.isFrozen(rows) || !rows.every(Object.isFrozen)) return false;
  immutable.add(rows);
  return true;
}
