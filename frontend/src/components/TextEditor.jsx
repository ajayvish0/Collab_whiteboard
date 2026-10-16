import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { TEXT_LINE_HEIGHT, worldToScreen } from "../lib/geometry.js";
import { fontSizeFor } from "../lib/shapes.js";
import { FONT_FAMILY } from "./ShapeView.jsx";

/**
 * Click-then-type text input, positioned over the canvas where the text will
 * appear. Enter commits, Shift+Enter adds a line, Esc cancels.
 */
export default function TextEditor({ editor, view, onChange, onCommit, onCancel }) {
  const ref = useRef(null);
  const p = worldToScreen(editor, view);
  const fontSize = fontSizeFor(editor.style.strokeWidth) * view.zoom;
  const lines = editor.text.split("\n");
  const longest = Math.max(1, ...lines.map((l) => l.length));

  useEffect(() => {
    const el = ref.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  return (
    <textarea
      ref={ref}
      aria-label="Text"
      value={editor.text}
      maxLength={1000}
      rows={lines.length}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onCancel();
        else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onCommit();
        }
      }}
      className="absolute z-10 resize-none overflow-hidden border-0 bg-transparent p-0 outline-2 outline-offset-4 outline-blue-400 outline-dashed"
      style={{
        left: p.x,
        top: p.y,
        width: `${longest + 2}ch`,
        fontSize,
        lineHeight: TEXT_LINE_HEIGHT,
        fontFamily: FONT_FAMILY,
        color: editor.style.stroke,
        whiteSpace: "pre",
      }}
    />
  );
}

TextEditor.propTypes = {
  editor: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    text: PropTypes.string.isRequired,
    style: PropTypes.shape({ stroke: PropTypes.string, strokeWidth: PropTypes.number }).isRequired,
  }).isRequired,
  view: PropTypes.shape({ x: PropTypes.number, y: PropTypes.number, zoom: PropTypes.number }).isRequired,
  onChange: PropTypes.func.isRequired,
  onCommit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
