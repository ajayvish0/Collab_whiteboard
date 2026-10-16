import { randomUUID } from "node:crypto";

const USER_COLORS = [
  "#e03131", "#2f9e44", "#1971c2", "#f08c00",
  "#9c36b5", "#0c8599", "#e8590c", "#5c940d",
];

// Keeps the boards that currently have participants in memory, and writes
// them to the store shortly after each change (debounced) and when the last
// participant leaves. The server is the single source of order: shapes are
// kept in the order the server received them.
export function createBoardManager({
  store,
  logger,
  saveDebounceMs = 2000,
  maxShapesPerBoard = 5000,
  maxUsersPerBoard = 50,
}) {
  const active = new Map(); // boardId -> board
  const loading = new Map(); // boardId -> Promise<board|null>

  function scheduleSave(board) {
    board.dirty = true;
    if (board.timer) return;
    board.timer = setTimeout(() => {
      board.timer = null;
      flush(board).catch((err) =>
        logger.error("board save failed", { boardId: board.id, err: err.message })
      );
    }, saveDebounceMs);
    board.timer.unref?.();
  }

  async function flush(board) {
    if (board.timer) {
      clearTimeout(board.timer);
      board.timer = null;
    }
    if (!board.dirty) return;
    board.dirty = false;
    const saved = await store.save(board.id, [...board.shapes.values()]);
    if (!saved) logger.warn("board vanished from store before save", { boardId: board.id });
  }

  async function load(id) {
    const stored = await store.load(id);
    if (!stored) return null;
    const board = {
      id,
      shapes: new Map(stored.shapes.map((s) => [s.id, s])),
      members: new Map(), // socketId -> user
      dirty: false,
      timer: null,
    };
    active.set(id, board);
    return board;
  }

  return {
    async create() {
      const id = randomUUID();
      await store.create(id);
      return id;
    },

    /** Loads a board into memory (once, even with concurrent joins). */
    async open(id) {
      if (active.has(id)) return active.get(id);
      if (!loading.has(id)) {
        loading.set(id, load(id).finally(() => loading.delete(id)));
      }
      return loading.get(id);
    },

    join(board, socketId, name) {
      if (board.members.size >= maxUsersPerBoard) return { error: "board_full" };
      const used = new Set([...board.members.values()].map((u) => u.color));
      const color = USER_COLORS.find((c) => !used.has(c)) ?? USER_COLORS[board.members.size % USER_COLORS.length];
      const user = { id: socketId, name: name ?? `Guest ${socketId.slice(0, 4)}`, color };
      board.members.set(socketId, user);
      // Joining counts as activity, so a board that is still in use is not
      // purged by the TTL job.
      scheduleSave(board);
      return { user };
    },

    async leave(board, socketId) {
      board.members.delete(socketId);
      if (board.members.size > 0) return;
      await flush(board);
      // Someone may have joined while the save was in flight.
      if (board.members.size === 0) active.delete(board.id);
    },

    /** Idempotent: shapes whose id already exists are ignored. */
    addShapes(board, shapes, authorId) {
      const added = [];
      for (const shape of shapes) {
        if (board.shapes.has(shape.id)) continue;
        if (board.shapes.size >= maxShapesPerBoard) {
          if (added.length) scheduleSave(board);
          return { added, error: "shape_limit_reached" };
        }
        const stored = { ...shape, authorId, createdAt: Date.now() };
        board.shapes.set(shape.id, stored);
        added.push(stored);
      }
      if (added.length) scheduleSave(board);
      return { added };
    },

    deleteShapes(board, ids) {
      const deleted = ids.filter((id) => board.shapes.delete(id));
      if (deleted.length) scheduleSave(board);
      return deleted;
    },

    clear(board) {
      board.shapes.clear();
      scheduleSave(board);
    },

    async purgeExpired(ttlMs, now = Date.now()) {
      const removed = await store.deleteOlderThan(now - ttlMs);
      if (removed) logger.info("purged expired boards", { removed });
      return removed;
    },

    async flushAll() {
      await Promise.all([...active.values()].map(flush));
    },

    get activeCount() {
      return active.size;
    },
  };
}
