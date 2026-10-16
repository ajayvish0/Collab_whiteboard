// Per-user undo/redo. Each entry is an operation { add: Shape[], remove: Shape[] }
// that this user performed. Undo applies the inverse operation, which other
// users then see like any other change. Only your own operations are undone.

const LIMIT = 100;

export const emptyHistory = { undo: [], redo: [] };

export const invert = (op) => ({ add: op.remove, remove: op.add });

export function record(history, op) {
  if (!op.add.length && !op.remove.length) return history;
  return { undo: [...history.undo, op].slice(-LIMIT), redo: [] };
}

/** Returns { op, history } where `op` is the operation to apply, or null. */
export function undo(history) {
  const last = history.undo[history.undo.length - 1];
  if (!last) return { op: null, history };
  return {
    op: invert(last),
    history: { undo: history.undo.slice(0, -1), redo: [...history.redo, last] },
  };
}

export function redo(history) {
  const last = history.redo[history.redo.length - 1];
  if (!last) return { op: null, history };
  return {
    op: last,
    history: { undo: [...history.undo, last], redo: history.redo.slice(0, -1) },
  };
}
