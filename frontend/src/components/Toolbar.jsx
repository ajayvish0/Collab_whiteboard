import PropTypes from "prop-types";
import { Icon } from "./icons.jsx";

const TOOLS = [
  { id: "pencil", label: "Pencil", key: "P" },
  { id: "eraser", label: "Eraser", key: "E" },
  { id: "rect", label: "Rectangle", key: "R" },
  { id: "ellipse", label: "Ellipse", key: "O" },
  { id: "text", label: "Text", key: "T" },
  { id: "hand", label: "Pan (or hold Space)", key: "H" },
];

const COLORS = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00", "#9c36b5"];

const btn =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-35 disabled:hover:bg-transparent";

export default function Toolbar({
  tool,
  onTool,
  color,
  onColor,
  strokeWidth,
  onStrokeWidth,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
}) {
  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      className="pointer-events-auto fixed bottom-3 left-1/2 z-20 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg md:top-1/2 md:bottom-auto md:left-3 md:max-w-none md:translate-x-0 md:-translate-y-1/2 md:flex-col md:overflow-visible"
    >
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`${btn} ${tool === t.id ? "bg-blue-600 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
          aria-label={`${t.label} (${t.key})`}
          aria-pressed={tool === t.id}
          title={`${t.label} — ${t.key}`}
          onClick={() => onTool(t.id)}
        >
          <Icon name={t.id} />
        </button>
      ))}

      <Divider />

      <div className="flex items-center gap-1 md:grid md:grid-cols-2" role="group" aria-label="Color">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            aria-pressed={color === c}
            title={c}
            onClick={() => onColor(c)}
            className={`h-6 w-6 shrink-0 rounded-full border-2 ${color === c ? "border-blue-600 ring-2 ring-blue-200" : "border-white ring-1 ring-zinc-300"}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <label className="flex shrink-0 items-center" title="Custom color">
        <span className="sr-only">Custom color</span>
        <input
          type="color"
          value={color}
          onChange={(e) => onColor(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
        />
      </label>

      <label className="flex shrink-0 flex-col items-center gap-0.5 px-1 text-[10px] text-zinc-500" title="Stroke width / text size">
        <span className="sr-only">Stroke width</span>
        <input
          type="range"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={(e) => onStrokeWidth(Number(e.target.value))}
          className="w-20 accent-blue-600 md:w-10"
        />
        <span aria-hidden="true">{strokeWidth}px</span>
      </label>

      <Divider />

      <button type="button" className={`${btn} text-zinc-700 hover:bg-zinc-100`} onClick={onUndo} disabled={!canUndo} aria-label="Undo (Ctrl+Z)" title="Undo — Ctrl+Z">
        <Icon name="undo" />
      </button>
      <button type="button" className={`${btn} text-zinc-700 hover:bg-zinc-100`} onClick={onRedo} disabled={!canRedo} aria-label="Redo (Ctrl+Shift+Z)" title="Redo — Ctrl+Shift+Z">
        <Icon name="redo" />
      </button>
      <button type="button" className={`${btn} text-red-600 hover:bg-red-50`} onClick={onClear} aria-label="Clear board" title="Clear board for everyone">
        <Icon name="trash" />
      </button>
    </div>
  );
}

function Divider() {
  return <div className="mx-0.5 h-6 w-px shrink-0 bg-zinc-200 md:mx-0 md:my-0.5 md:h-px md:w-6" />;
}

Toolbar.propTypes = {
  tool: PropTypes.string.isRequired,
  onTool: PropTypes.func.isRequired,
  color: PropTypes.string.isRequired,
  onColor: PropTypes.func.isRequired,
  strokeWidth: PropTypes.number.isRequired,
  onStrokeWidth: PropTypes.func.isRequired,
  canUndo: PropTypes.bool.isRequired,
  canRedo: PropTypes.bool.isRequired,
  onUndo: PropTypes.func.isRequired,
  onRedo: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};
