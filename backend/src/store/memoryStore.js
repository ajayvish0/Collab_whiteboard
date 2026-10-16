// In-process store. Used for tests and local development. Data is lost when
// the process exits.
export function createMemoryStore({ maxBoards = 10_000 } = {}) {
  const boards = new Map();
  const clone = (v) => structuredClone(v);

  return {
    kind: "memory",

    async init() {},

    async create(id, now = Date.now()) {
      // Evict the least recently updated board if full. Map preserves
      // insertion order and `save` re-inserts, so the first key is the oldest.
      if (boards.size >= maxBoards) boards.delete(boards.keys().next().value);
      boards.set(id, { shapes: [], createdAt: now, updatedAt: now });
    },

    async load(id) {
      const board = boards.get(id);
      return board ? clone(board) : null;
    },

    async save(id, shapes, now = Date.now()) {
      const board = boards.get(id);
      if (!board) return false;
      boards.delete(id);
      boards.set(id, { ...board, shapes: clone(shapes), updatedAt: now });
      return true;
    },

    async deleteOlderThan(cutoff) {
      let removed = 0;
      for (const [id, board] of boards) {
        if (board.updatedAt < cutoff) {
          boards.delete(id);
          removed++;
        }
      }
      return removed;
    },

    async close() {},
  };
}
