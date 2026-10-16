import { describe, expect, it, vi } from "vitest";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  boundsOfAll,
  hitTest,
  normalizeRect,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from "./geometry.js";
import { appendPoint, createBox, createText, fontSizeFor, pointsToPath } from "./shapes.js";
import { emptyHistory, record, redo, undo } from "./history.js";
import { applyLive, applyOp } from "./boardState.js";
import { throttle } from "./throttle.js";

const style = { stroke: "#000000", strokeWidth: 2 };

describe("coordinates", () => {
  const view = { x: 100, y: 50, zoom: 2 };

  it("screen ↔ world round-trips", () => {
    const w = screenToWorld({ x: 300, y: 250 }, view);
    expect(w).toEqual({ x: 100, y: 100 });
    expect(worldToScreen(w, view)).toEqual({ x: 300, y: 250 });
  });

  it("zoomAt keeps the world point under the cursor fixed", () => {
    const cursor = { x: 420, y: 310 };
    const before = screenToWorld(cursor, view);
    const next = zoomAt(view, cursor, 3.3);
    const after = screenToWorld(cursor, next);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  // Audit I-8: the view used to drift when zooming past the limits.
  it("does not move the view at the zoom limits", () => {
    const atMax = { x: 10, y: 20, zoom: MAX_ZOOM };
    expect(zoomAt(atMax, { x: 500, y: 500 }, MAX_ZOOM * 1.2)).toBe(atMax);
    const atMin = { x: 10, y: 20, zoom: MIN_ZOOM };
    expect(zoomAt(atMin, { x: 500, y: 500 }, MIN_ZOOM / 2)).toBe(atMin);
  });

  it("normalizes rectangles dragged in any direction", () => {
    expect(normalizeRect({ x: 10, y: 10 }, { x: 0, y: 4 })).toEqual({ x: 0, y: 4, w: 10, h: 6 });
  });
});

describe("shape factories", () => {
  // Audit I-5: text used to be stored without a size and rendered at NaNpx.
  it("text shapes carry a font size derived from the stroke width", () => {
    const t = createText("t", { x: 1, y: 2 }, "hello", { stroke: "#ff0000", strokeWidth: 4 });
    expect(t).toMatchObject({ type: "text", text: "hello", fontSize: fontSizeFor(4) });
    expect(Number.isFinite(t.fontSize)).toBe(true);
  });

  it("boxes are normalized and rounded", () => {
    const r = createBox("r", "rect", { x: 10.123, y: 5 }, { x: 0, y: 0 }, style);
    expect(r).toMatchObject({ x: 0, y: 0, w: 10.12, h: 5 });
  });

  it("appendPoint skips points closer than the minimum distance", () => {
    const pts = [[0, 0]];
    expect(appendPoint(pts, { x: 0.5, y: 0 }, 1)).toBe(pts);
    expect(appendPoint(pts, { x: 3, y: 4 }, 1)).toEqual([[0, 0], [3, 4]]);
  });

  it("builds valid SVG paths for 1, 2 and many points", () => {
    expect(pointsToPath([[1, 2]])).toBe("M 1 2 l 0.01 0");
    expect(pointsToPath([[0, 0], [5, 5]])).toBe("M 0 0 L 5 5");
    const d = pointsToPath([[0, 0], [10, 0], [10, 10], [0, 10]]);
    expect(d).toMatch(/^M 0 0 Q .* L 0 10$/);
    expect(d).not.toMatch(/null|NaN|undefined/);
  });
});

describe("hit testing (object eraser)", () => {
  const line = { id: "l", type: "pencil", style, points: [[0, 0], [100, 0]] };
  const rect = { id: "r", type: "rect", style, x: 0, y: 0, w: 100, h: 50 };
  const ellipse = { id: "e", type: "ellipse", style, x: 0, y: 0, w: 100, h: 50 };
  const text = { id: "t", type: "text", style, x: 0, y: 0, text: "hello", fontSize: 20 };

  it("hits a stroke near its segments only", () => {
    expect(hitTest(line, { x: 50, y: 3 }, 3)).toBe(true);
    expect(hitTest(line, { x: 50, y: 20 }, 3)).toBe(false);
  });

  it("hits outlined shapes on the outline, not the inside", () => {
    expect(hitTest(rect, { x: 50, y: 1 }, 3)).toBe(true);
    expect(hitTest(rect, { x: 50, y: 25 }, 3)).toBe(false);
    expect(hitTest(ellipse, { x: 100, y: 25 }, 3)).toBe(true);
    expect(hitTest(ellipse, { x: 50, y: 25 }, 3)).toBe(false);
  });

  it("hits text anywhere in its box", () => {
    expect(hitTest(text, { x: 10, y: 10 }, 2)).toBe(true);
    expect(hitTest(text, { x: 500, y: 10 }, 2)).toBe(false);
  });

  it("computes bounds of all shapes including stroke width", () => {
    expect(boundsOfAll([])).toBeNull();
    expect(boundsOfAll([line, rect])).toEqual({ x: -1, y: -1, w: 102, h: 52 });
  });
});

describe("undo / redo", () => {
  const a = { id: "a" };
  const b = { id: "b" };

  it("undo inverts the last operation and redo reapplies it", () => {
    let h = record(emptyHistory, { add: [a], remove: [] });
    h = record(h, { add: [], remove: [b] });

    let r = undo(h);
    expect(r.op).toEqual({ add: [b], remove: [] });
    r = undo(r.history);
    expect(r.op).toEqual({ add: [], remove: [a] });
    expect(undo(r.history).op).toBeNull();

    r = redo(r.history);
    expect(r.op).toEqual({ add: [a], remove: [] });
  });

  it("a new operation clears the redo stack", () => {
    let h = record(emptyHistory, { add: [a], remove: [] });
    h = undo(h).history;
    h = record(h, { add: [b], remove: [] });
    expect(redo(h).op).toBeNull();
  });

  it("ignores empty operations", () => {
    expect(record(emptyHistory, { add: [], remove: [] })).toBe(emptyHistory);
  });
});

describe("board state", () => {
  const s1 = { id: "1" };
  const s2 = { id: "2" };

  // Audit I-1: duplicate deliveries used to duplicate shapes.
  it("adding an existing id is a no-op", () => {
    const m = applyOp(new Map(), "shape:add", { shapes: [s1] });
    expect(applyOp(m, "shape:add", { shapes: [s1] })).toBe(m);
  });

  it("deletes and clears", () => {
    let m = applyOp(new Map(), "shape:add", { shapes: [s1, s2] });
    m = applyOp(m, "shape:delete", { ids: ["1"] });
    expect([...m.keys()]).toEqual(["2"]);
    expect(applyOp(m, "board:clear").size).toBe(0);
  });

  it("assembles incremental live pencil strokes", () => {
    const base = { id: "s", type: "pencil", style };
    let live = applyLive(new Map(), "u", { ...base, points: [[0, 0]], append: false });
    live = applyLive(live, "u", { ...base, points: [[1, 1]], append: true });
    expect(live.get("u")).toEqual({ ...base, points: [[0, 0], [1, 1]] });
    // A new stroke replaces the previous one.
    live = applyLive(live, "u", { ...base, id: "s2", points: [[5, 5]], append: false });
    expect(live.get("u").points).toEqual([[5, 5]]);
  });
});

describe("throttle", () => {
  it("runs at most once per interval with the latest arguments", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = throttle(fn, 50);
    t(1);
    t(2);
    t(3);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenLastCalledWith(3);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
