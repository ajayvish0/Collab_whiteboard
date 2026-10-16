// Pure reducers for the board's shape map (id -> shape, insertion-ordered).
// The same operations are applied locally (optimistically) and when they
// arrive from the server, so applying one twice must be harmless.

export function applyOp(shapes, event, payload) {
  switch (event) {
    case "shape:add": {
      const fresh = payload.shapes.filter((s) => !shapes.has(s.id));
      if (!fresh.length) return shapes;
      const next = new Map(shapes);
      for (const s of fresh) next.set(s.id, s);
      return next;
    }
    case "shape:delete": {
      if (!payload.ids.some((id) => shapes.has(id))) return shapes;
      const next = new Map(shapes);
      for (const id of payload.ids) next.delete(id);
      return next;
    }
    case "board:clear":
      return shapes.size ? new Map() : shapes;
    default:
      return shapes;
  }
}

/** Merges an in-progress stroke update from a peer into the live map. */
export function applyLive(live, userId, stroke) {
  const next = new Map(live);
  const current = live.get(userId);
  if (stroke.type === "pencil" && stroke.append && current?.id === stroke.id) {
    next.set(userId, { ...current, points: [...current.points, ...stroke.points] });
  } else {
    // eslint-disable-next-line no-unused-vars
    const { append, ...shape } = stroke;
    if (shape.type === "pencil" && !shape.points.length) return live;
    next.set(userId, shape);
  }
  return next;
}

export function without(map, key) {
  if (!map.has(key)) return map;
  const next = new Map(map);
  next.delete(key);
  return next;
}
