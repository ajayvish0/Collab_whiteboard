import { memo } from "react";
import PropTypes from "prop-types";
import { TEXT_LINE_HEIGHT } from "../lib/geometry.js";
import { pointsToPath } from "../lib/shapes.js";

export const FONT_FAMILY = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

/** Renders one shape as SVG, in world coordinates. */
export const ShapeView = memo(function ShapeView({ shape, opacity = 1 }) {
  const { stroke, strokeWidth } = shape.style;
  const common = {
    stroke,
    strokeWidth,
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    opacity,
    "data-shape-id": shape.id,
  };

  switch (shape.type) {
    case "pencil":
      return <path d={pointsToPath(shape.points)} {...common} />;
    case "rect":
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={Math.min(8, shape.w / 4, shape.h / 4)}
          {...common}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={shape.x + shape.w / 2}
          cy={shape.y + shape.h / 2}
          rx={shape.w / 2}
          ry={shape.h / 2}
          {...common}
        />
      );
    case "text":
      // `y` is the top of the text box; each line gets an explicit baseline
      // so rendering matches the textarea used for editing.
      return (
        <text
          fill={stroke}
          fontSize={shape.fontSize}
          fontFamily={FONT_FAMILY}
          opacity={opacity}
          data-shape-id={shape.id}
          style={{ whiteSpace: "pre" }}
        >
          {shape.text.split("\n").map((line, i) => (
            <tspan key={i} x={shape.x} y={shape.y + shape.fontSize * (TEXT_LINE_HEIGHT * i + 1)}>
              {line || " "}
            </tspan>
          ))}
        </text>
      );
    default:
      return null;
  }
});

const shapeShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  type: PropTypes.oneOf(["pencil", "rect", "ellipse", "text"]).isRequired,
  style: PropTypes.shape({
    stroke: PropTypes.string.isRequired,
    strokeWidth: PropTypes.number.isRequired,
  }).isRequired,
  points: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  x: PropTypes.number,
  y: PropTypes.number,
  w: PropTypes.number,
  h: PropTypes.number,
  text: PropTypes.string,
  fontSize: PropTypes.number,
});

ShapeView.propTypes = { shape: shapeShape.isRequired, opacity: PropTypes.number };

/** All committed shapes. Memoized so cursor and draft updates don't re-render it. */
export const ShapeLayer = memo(function ShapeLayer({ shapes, hiddenId, fadedIds }) {
  return shapes.map((s) =>
    s.id === hiddenId ? null : (
      <ShapeView key={s.id} shape={s} opacity={fadedIds.has(s.id) ? 0.25 : 1} />
    )
  );
});

ShapeLayer.propTypes = {
  shapes: PropTypes.arrayOf(shapeShape).isRequired,
  hiddenId: PropTypes.string,
  fadedIds: PropTypes.instanceOf(Set).isRequired,
};
