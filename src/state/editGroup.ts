// Synchronous mutation context: all accepted values in one field focus share one undo step.
let group: string | undefined;
export const currentEditGroup = () => group;
export function withEditGroup<T>(id: string, action: () => T): T {
  const previous = group;
  group = id;
  try {
    return action();
  } finally {
    group = previous;
  }
}
