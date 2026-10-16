import PropTypes from "prop-types";
import { MAX_ZOOM, MIN_ZOOM } from "../lib/geometry.js";
import { Icon } from "./icons.jsx";

const STEP = 1.2;
const btn = "flex h-8 w-8 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 disabled:opacity-35";

export default function ZoomControls({ zoom, onZoomBy, onReset }) {
  return (
    <div className="fixed right-3 bottom-20 z-20 flex items-center rounded-xl border border-zinc-200 bg-white p-1 shadow-lg md:bottom-3">
      <button type="button" className={btn} onClick={() => onZoomBy(1 / STEP)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out (-)" title="Zoom out — -">
        <Icon name="minus" className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="min-w-14 rounded-md px-1 text-sm tabular-nums text-zinc-700 hover:bg-zinc-100"
        onClick={onReset}
        aria-label={`Zoom ${Math.round(zoom * 100)}%. Reset to 100% (0)`}
        title="Reset zoom — 0"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className={btn} onClick={() => onZoomBy(STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in (+)" title="Zoom in — +">
        <Icon name="plus" className="h-4 w-4" />
      </button>
    </div>
  );
}

ZoomControls.propTypes = {
  zoom: PropTypes.number.isRequired,
  onZoomBy: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
};
