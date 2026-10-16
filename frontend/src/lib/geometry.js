// Pure coordinate math. "Screen" points are CSS pixels relative to the
// canvas element; "world" points are board coordinates that shapes use.
// A view is { x, y, zoom }: screen = world * zoom + (x, y).

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

export const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export function screenToWorld(point, view) {
  return { x: (point.x - view.x) / view.zoom, y: (point.y - view.y) / view.zoom };
}

export function worldToScreen(point, view) {
  return { x: point.x * view.zoom + view.x, y: point.y * view.zoom + view.y };
}

/**
 * Zooms to `nextZoom` (clamped) while keeping the world point under
 * `screenPoint` fixed. At the zoom limits the view does not move.
 */
export function zoomAt(view, screenPoint, nextZoom) {
  const zoom = clampZoom(nextZoom);
  if (zoom === view.zoom) return view;
  const world = screenToWorld(screenPoint, view);
  return {
    zoom,
    x: screenPoint.x - world.x * zoom,
    y: screenPoint.y - world.y * zoom,
  };
}

/** Rectangle from two corner points, with non-negative width and height. */
export function normalizeRect(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export const TEXT_LINE_HEIGHT = 1.25;
// Average glyph width relative to font size for the UI sans-serif font.
const TEXT_CHAR_WIDTH = 0.6;

export function textBox(shape) {
  const lines = shape.text.split("\n");
  const longest = Math.max(...lines.map((l) => l.length));
  return {
    x: shape.x,
    y: shape.y,
    w: Math.max(1, longest) * shape.fontSize * TEXT_CHAR_WIDTH,
    h: lines.length * shape.fontSize * TEXT_LINE_HEIGHT,
  };
}

/** Axis-aligned bounds { x, y, w, h } of a shape, ignoring stroke width. */
export function shapeBounds(shape) {
  switch (shape.type) {
    case "pencil": {
      const xs = shape.points.map((p) => p[0]);
      const ys = shape.points.map((p) => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    case "rect":
    case "ellipse":
      return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    case "text":
      return textBox(shape);
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}

const inBox = (p, b, pad = 0) =>
  p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;

/**
 * True when world point `p` touches the shape's visible stroke, within
 * `tolerance` world units. Outlined shapes are hit on their outline only,
 * like in most drawing tools, so you can erase a shape drawn inside another.
 */
export function hitTest(shape, p, tolerance) {
  const reach = tolerance + shape.style.strokeWidth / 2;
  switch (shape.type) {
    case "pencil": {
      const pts = shape.points;
      if (!inBox(p, shapeBounds(shape), reach)) return false;
      if (pts.length === 1) return distance(p, { x: pts[0][0], y: pts[0][1] }) <= reach;
      for (let i = 1; i < pts.length; i++) {
        const a = { x: pts[i - 1][0], y: pts[i - 1][1] };
        const b = { x: pts[i][0], y: pts[i][1] };
        if (distanceToSegment(p, a, b) <= reach) return true;
      }
      return false;
    }
    case "rect": {
      const { x, y, w, h } = shape;
      const corners = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      return corners.some((a, i) => distanceToSegment(p, a, corners[(i + 1) % 4]) <= reach);
    }
    case "ellipse": {
      const rx = shape.w / 2;
      const ry = shape.h / 2;
      if (rx < 1e-6 || ry < 1e-6) {
        return distanceToSegment(p, { x: shape.x, y: shape.y }, { x: shape.x + shape.w, y: shape.y + shape.h }) <= reach;
      }
      const dx = p.x - (shape.x + rx);
      const dy = p.y - (shape.y + ry);
      const r = Math.hypot(dx / rx, dy / ry);
      // Approximate distance to the outline along the radial direction.
      return Math.abs(r - 1) * Math.min(rx, ry) <= reach;
    }
    case "text":
      return inBox(p, textBox(shape), tolerance);
    default:
      return false;
  }
}

/** Bounds enclosing all shapes, including stroke width, or null if empty. */
export function boundsOfAll(shapes) {
  if (!shapes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of shapes) {
    const b = shapeBounds(s);
    const pad = s.type === "text" ? 0 : s.style.strokeWidth / 2;
    minX = Math.min(minX, b.x - pad);
    minY = Math.min(minY, b.y - pad);
    maxX = Math.max(maxX, b.x + b.w + pad);
    maxY = Math.max(maxY, b.y + b.h + pad);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
