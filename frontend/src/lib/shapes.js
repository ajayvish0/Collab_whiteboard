import { distance, normalizeRect } from "./geometry.js";

// Shape model shared with the server (see backend/src/schemas.js):
//   { id, type: "pencil" | "rect" | "ellipse" | "text", style: { stroke, strokeWidth }, ... }
//   pencil:  points: [[x, y], ...]
//   rect / ellipse: x, y, w, h
//   text:    x, y (top-left), text, fontSize

export const newId = () => crypto.randomUUID();

const round = (n) => Math.round(n * 100) / 100;

export const fontSizeFor = (strokeWidth) => 12 + strokeWidth * 3;

export function createPencil(id, start, style) {
  return { id, type: "pencil", style, points: [[round(start.x), round(start.y)]] };
}

/**
 * Adds a point unless it is closer than `minDistance` to the previous one,
 * which keeps strokes small without visibly changing them.
 */
export function appendPoint(points, p, minDistance) {
  const [lx, ly] = points[points.length - 1];
  if (distance({ x: lx, y: ly }, p) < minDistance) return points;
  return [...points, [round(p.x), round(p.y)]];
}

export function createBox(id, type, start, end, style) {
  const r = normalizeRect(start, end);
  return { id, type, style, x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h) };
}

export function createText(id, at, text, style) {
  return {
    id,
    type: "text",
    style,
    x: round(at.x),
    y: round(at.y),
    text,
    fontSize: fontSizeFor(style.strokeWidth),
  };
}

/** Smooth SVG path through the points (quadratic curves through midpoints). */
export function pointsToPath(points) {
  if (!points.length) return "";
  const [x0, y0] = points[0];
  if (points.length === 1) return `M ${x0} ${y0} l 0.01 0`;
  if (points.length === 2) return `M ${x0} ${y0} L ${points[1][0]} ${points[1][1]}`;
  let d = `M ${x0} ${y0}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += ` Q ${x} ${y} ${round((x + nx) / 2)} ${round((y + ny) / 2)}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L ${lx} ${ly}`;
}
