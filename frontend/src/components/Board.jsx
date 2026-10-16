import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useParams } from "react-router-dom";

import { useBoard } from "../hooks/useBoard.js";
import { useViewport } from "../hooks/useViewport.js";
import { exportPng, exportSvg } from "../lib/export.js";
import { clampZoom, distance, hitTest, screenToWorld } from "../lib/geometry.js";
import { emptyHistory, record, redo as redoOp, undo as undoOp } from "../lib/history.js";
import { getDisplayName, setDisplayName } from "../lib/identity.js";
import { appendPoint, createBox, createPencil, createText, newId } from "../lib/shapes.js";
import { throttle } from "../lib/throttle.js";

import BoardMessage from "./BoardMessage.jsx";
import Cursors from "./Cursors.jsx";
import { ShapeLayer, ShapeView } from "./ShapeView.jsx";
import TextEditor from "./TextEditor.jsx";
import Toolbar from "./Toolbar.jsx";
import TopBar from "./TopBar.jsx";
import ZoomControls from "./ZoomControls.jsx";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORTCUTS = { p: "pencil", e: "eraser", r: "rect", o: "ellipse", t: "text", h: "hand" };
const ERASER_TOLERANCE_PX = 6;
const LIVE_INTERVAL_MS = 50;
const MAX_LIVE_POINTS = 500;
const EMPTY_SET = new Set();

export default function Board() {
  const { boardId } = useParams();
  if (!UUID_RE.test(boardId ?? "")) return <BoardMessage kind="not_found" />;
  // Remount on navigation so no state leaks between boards.
  return <BoardCanvas key={boardId} boardId={boardId} />;
}

function BoardCanvas({ boardId }) {
  const [initialName] = useState(getDisplayName);
  const board = useBoard(boardId, initialName);
  const {
    addShapes,
    deleteShapes,
    clear,
    sendCursor,
    sendLive,
    endLive,
    rename,
    remoteClears,
  } = board;

  const svgRef = useRef(null);
  const layerRef = useRef(null);
  const { view, setView, zoomBy, resetZoom } = useViewport(svgRef);

  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#1e1e1e");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const style = useMemo(() => ({ stroke: color, strokeWidth }), [color, strokeWidth]);

  const [draft, setDraftState] = useState(null);
  const draftRef = useRef(null);
  const setDraft = (d) => {
    draftRef.current = d;
    setDraftState(d);
  };

  const [editor, setEditorState] = useState(null);
  const editorRef = useRef(null);
  const setEditor = (e) => {
    editorRef.current = e;
    setEditorState(e);
  };

  const [erasing, setErasing] = useState(EMPTY_SET);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [history, setHistory] = useState(emptyHistory);

  const gesture = useRef(null);
  const pointers = useRef(new Map());
  const liveSent = useRef(0);

  const shapes = useMemo(() => [...board.shapes.values()], [board.shapes]);
  const users = useMemo(() => [...board.users.values()], [board.users]);

  // Undo history refers to shapes that a clear removed; start fresh.
  useEffect(() => {
    if (remoteClears) setHistory(emptyHistory);
  }, [remoteClears]);

  // ------------------------------------------------------------ operations
  const apply = useCallback(
    (op) => {
      if (op.remove.length) deleteShapes(op.remove.map((s) => s.id));
      if (op.add.length) addShapes(op.add);
    },
    [addShapes, deleteShapes]
  );

  const perform = useCallback(
    (op) => {
      apply(op);
      setHistory((h) => record(h, op));
    },
    [apply]
  );

  const undo = useCallback(() => {
    const { op, history: next } = undoOp(history);
    if (!op) return;
    apply(op);
    setHistory(next);
  }, [history, apply]);

  const redo = useCallback(() => {
    const { op, history: next } = redoOp(history);
    if (!op) return;
    apply(op);
    setHistory(next);
  }, [history, apply]);

  const handleClear = useCallback(() => {
    if (!shapes.length) return;
    if (!window.confirm("Clear the board for everyone? This cannot be undone.")) return;
    clear();
    setHistory(emptyHistory);
  }, [shapes.length, clear]);

  const handleExport = useCallback(
    (format) => {
      if (!shapes.length || !layerRef.current) return;
      const name = `teamsketch-${new Date().toISOString().slice(0, 10)}`;
      if (format === "svg") exportSvg(layerRef.current, shapes, `${name}.svg`);
      else exportPng(layerRef.current, shapes, `${name}.png`);
    },
    [shapes]
  );

  const handleRename = useCallback(
    (name) => {
      setDisplayName(name);
      rename(name);
    },
    [rename]
  );

  // ------------------------------------------------------------ live strokes
  const flushLive = useMemo(
    () =>
      throttle(() => {
        const d = draftRef.current;
        if (!d) return;
        if (d.type === "pencil") {
          const fresh = d.points.slice(liveSent.current, liveSent.current + MAX_LIVE_POINTS);
          if (!fresh.length) return;
          sendLive({ id: d.id, type: "pencil", style: d.style, points: fresh, append: liveSent.current > 0 });
          liveSent.current += fresh.length;
        } else {
          sendLive(d);
        }
      }, LIVE_INTERVAL_MS),
    [sendLive]
  );

  useEffect(() => () => flushLive.cancel(), [flushLive]);

  const discardDraft = () => {
    const d = draftRef.current;
    if (!d) return;
    flushLive.cancel();
    endLive(d.id);
    setDraft(null);
  };

  // --------------------------------------------------------------- text
  const commitText = () => {
    const ed = editorRef.current;
    if (!ed) return;
    setEditor(null);
    const text = ed.text.replace(/\s+$/, "");
    const original = ed.original;
    if (original && text === original.text) return;
    perform({
      add: text.trim() ? [createText(newId(), ed, text, ed.style)] : [],
      remove: original ? [original] : [],
    });
  };

  // ------------------------------------------------------------- pointer
  const toScreen = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const eraseAt = (p) => {
    const g = gesture.current;
    const tolerance = ERASER_TOLERANCE_PX / view.zoom;
    let changed = false;
    for (const s of shapes) {
      if (!g.hits.has(s.id) && hitTest(s, p, tolerance)) {
        g.hits.add(s.id);
        changed = true;
      }
    }
    if (changed) setErasing(new Set(g.hits));
  };

  const onPointerDown = (e) => {
    if (editorRef.current) {
      // Clicking outside the text box finishes editing.
      e.preventDefault();
      commitText();
      return;
    }
    const screen = toScreen(e);
    pointers.current.set(e.pointerId, screen);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Not capturable (e.g. synthetic events); drawing still works without it.
    }

    if (pointers.current.size === 2) {
      // Second finger: switch to pinch-zoom and drop the stroke in progress.
      discardDraft();
      setErasing(EMPTY_SET);
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: "pinch",
        startDist: Math.max(1, distance(a, b)),
        startView: view,
        anchor: screenToWorld({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view),
      };
      return;
    }
    if (pointers.current.size > 2) return;

    if (e.button === 1 || tool === "hand" || spaceHeld) {
      gesture.current = { kind: "pan", last: screen };
      return;
    }
    if (e.button !== 0) return;

    const p = screenToWorld(screen, view);
    liveSent.current = 0;
    switch (tool) {
      case "pencil":
        gesture.current = { kind: "draw" };
        setDraft(createPencil(newId(), p, style));
        break;
      case "rect":
      case "ellipse":
        gesture.current = { kind: "draw", start: p };
        setDraft(createBox(newId(), tool, p, p, style));
        break;
      case "eraser":
        gesture.current = { kind: "erase", hits: new Set() };
        eraseAt(p);
        break;
      case "text": {
        e.preventDefault(); // keep focus on the textarea that is about to mount
        const hit = [...shapes]
          .reverse()
          .find((s) => s.type === "text" && hitTest(s, p, 4 / view.zoom));
        setEditor(
          hit
            ? { x: hit.x, y: hit.y, text: hit.text, style: hit.style, original: hit }
            : { x: p.x, y: p.y, text: "", style }
        );
        break;
      }
    }
  };

  const onPointerMove = (e) => {
    const screen = toScreen(e);
    const p = screenToWorld(screen, view);
    sendCursor(p);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, screen);

    const g = gesture.current;
    if (!g) return;
    switch (g.kind) {
      case "pinch": {
        const [a, b] = [...pointers.current.values()];
        const zoom = clampZoom(g.startView.zoom * (distance(a, b) / g.startDist));
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        setView({ zoom, x: mid.x - g.anchor.x * zoom, y: mid.y - g.anchor.y * zoom });
        break;
      }
      case "pan": {
        const dx = screen.x - g.last.x;
        const dy = screen.y - g.last.y;
        g.last = screen;
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
        break;
      }
      case "draw": {
        const d = draftRef.current;
        if (!d) return;
        if (d.type === "pencil") {
          // Coalesced events give the full-resolution path on fast moves.
          const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
          let points = d.points;
          for (const ev of events.length ? events : [e]) {
            points = appendPoint(points, screenToWorld(toScreen(ev), view), 1 / view.zoom);
          }
          if (points !== d.points) setDraft({ ...d, points });
        } else {
          setDraft(createBox(d.id, d.type, g.start, p, d.style));
        }
        flushLive();
        break;
      }
      case "erase":
        eraseAt(p);
        break;
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    gesture.current = null;

    if (g.kind === "draw") {
      const d = draftRef.current;
      if (!d) return;
      if (e.type === "pointercancel") return discardDraft();
      flushLive.cancel();
      setDraft(null);
      const tooSmall = d.type !== "pencil" && d.w < 2 / view.zoom && d.h < 2 / view.zoom;
      if (tooSmall) endLive(d.id);
      else perform({ add: [d], remove: [] });
    } else if (g.kind === "erase") {
      setErasing(EMPTY_SET);
      if (e.type === "pointercancel" || !g.hits.size) return;
      perform({ add: [], remove: shapes.filter((s) => g.hits.has(s.id)) });
    }
  };

  // ------------------------------------------------------------- keyboard
  useEffect(() => {
    const isTyping = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

    const onKeyDown = (e) => {
      if (isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (key === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (key === "y") {
          e.preventDefault();
          redo();
        }
        return;
      }
      if (e.altKey) return;
      if (key === " ") {
        e.preventDefault();
        setSpaceHeld(true);
      } else if (SHORTCUTS[key]) setTool(SHORTCUTS[key]);
      else if (key === "+" || key === "=") zoomBy(1.2);
      else if (key === "-") zoomBy(1 / 1.2);
      else if (key === "0") resetZoom();
    };
    const onKeyUp = (e) => {
      if (e.key === " ") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [undo, redo, zoomBy, resetZoom]);

  // --------------------------------------------------------------- render
  if (["not_found", "full", "error"].includes(board.status)) {
    return <BoardMessage kind={board.status} />;
  }

  const panning = tool === "hand" || spaceHeld;
  const cursor = panning
    ? gesture.current?.kind === "pan"
      ? "grabbing"
      : "grab"
    : tool === "text"
      ? "text"
      : tool === "eraser"
        ? "cell"
        : "crosshair";
  const gridSize = 24 * view.zoom;

  return (
    <div className="fixed inset-0 overflow-hidden bg-white select-none">
      <svg
        ref={svgRef}
        data-testid="canvas"
        className="absolute inset-0 h-full w-full touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern
            id="grid"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
            x={view.x % gridSize}
            y={view.y % gridSize}
          >
            <circle cx={1} cy={1} r={1} fill="#d4d4d8" />
          </pattern>
        </defs>
        {view.zoom >= 0.4 && <rect width="100%" height="100%" fill="url(#grid)" />}

        <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
          <g ref={layerRef}>
            <ShapeLayer shapes={shapes} hiddenId={editor?.original?.id} fadedIds={erasing} />
          </g>
          {[...board.live.values()].map((s) => (
            <ShapeView key={`live-${s.id}`} shape={s} opacity={0.6} />
          ))}
          {draft && <ShapeView shape={draft} />}
        </g>
      </svg>

      {board.status === "joined" && !shapes.length && !draft && !board.live.size && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-8 text-center text-zinc-400">
          Draw anything. Use Share to invite others.
        </p>
      )}

      <Cursors cursors={board.cursors} users={board.users} view={view} />

      {editor && (
        <TextEditor
          editor={editor}
          view={view}
          onChange={(text) => setEditor({ ...editorRef.current, text })}
          onCommit={commitText}
          onCancel={() => setEditor(null)}
        />
      )}

      <TopBar
        status={board.status}
        users={users}
        self={board.self}
        onRename={handleRename}
        onExport={handleExport}
      />

      <Toolbar
        tool={tool}
        onTool={setTool}
        color={color}
        onColor={setColor}
        strokeWidth={strokeWidth}
        onStrokeWidth={setStrokeWidth}
        canUndo={history.undo.length > 0}
        canRedo={history.redo.length > 0}
        onUndo={undo}
        onRedo={redo}
        onClear={handleClear}
      />

      <ZoomControls zoom={view.zoom} onZoomBy={zoomBy} onReset={resetZoom} />

      <ConnectionBanner status={board.status} />

      {board.notice && (
        <div
          role="alert"
          className="fixed top-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {board.notice}
          <button type="button" className="text-zinc-300 underline" onClick={board.dismissNotice}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

BoardCanvas.propTypes = { boardId: PropTypes.string.isRequired };

function ConnectionBanner({ status }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (status !== "connecting") return;
    const t = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(t);
  }, [status]);

  let text = null;
  if (status === "connecting" && slow) {
    text = "Waking up the server. On free hosting this can take up to a minute.";
  } else if (status === "reconnecting") {
    text = "Connection lost. Reconnecting… Your changes will sync when it's back.";
  }
  if (!text) return null;
  return (
    <div
      role="status"
      className="fixed top-16 left-1/2 z-30 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 shadow"
    >
      {text}
    </div>
  );
}

ConnectionBanner.propTypes = { status: PropTypes.string.isRequired };
