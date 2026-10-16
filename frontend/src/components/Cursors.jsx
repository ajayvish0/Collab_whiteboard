import PropTypes from "prop-types";
import { worldToScreen } from "../lib/geometry.js";

/** Other participants' pointers, drawn in screen space above the canvas. */
export default function Cursors({ cursors, users, view }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {[...cursors].map(([userId, point]) => {
        const user = users.get(userId);
        if (!user) return null;
        const p = worldToScreen(point, view);
        return (
          <div
            key={userId}
            className="absolute top-0 left-0 transition-transform duration-75 ease-linear"
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow-sm">
              <path d="M1 1 L1 15 L5 11 L8 17 L10.5 16 L7.5 10 L13 10 Z" fill={user.color} stroke="white" strokeWidth="1.2" />
            </svg>
            <span
              className="ml-3 -mt-1 block rounded px-1.5 py-0.5 text-[11px] whitespace-nowrap text-white"
              style={{ background: user.color }}
            >
              {user.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

Cursors.propTypes = {
  cursors: PropTypes.instanceOf(Map).isRequired,
  users: PropTypes.instanceOf(Map).isRequired,
  view: PropTypes.shape({ x: PropTypes.number, y: PropTypes.number, zoom: PropTypes.number }).isRequired,
};
