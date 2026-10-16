import { useCallback, useEffect, useState } from "react";
import { zoomAt } from "../lib/geometry.js";

const WHEEL_ZOOM_SPEED = 0.0015;
const LINE_HEIGHT_PX = 16;

/**
 * Pan/zoom state for the canvas element in `ref`. Follows the convention of
 * most design tools: wheel or two-finger scroll pans, Ctrl/⌘ + wheel or a
 * trackpad pinch zooms at the cursor.
 */
export function useViewport(ref) {
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // React attaches wheel listeners as passive, where preventDefault() is
    // ignored, so the browser would also zoom/scroll the page. Use a native
    // non-passive listener instead.
    const onWheel = (e) => {
      e.preventDefault();
      const scale = e.deltaMode === 1 ? LINE_HEIGHT_PX : 1;
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const factor = Math.exp(-e.deltaY * scale * WHEEL_ZOOM_SPEED * (e.ctrlKey ? 5 : 1));
        setView((v) => zoomAt(v, point, v.zoom * factor));
      } else {
        const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * scale;
        const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * scale;
        setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);

  const center = useCallback(() => {
    const el = ref.current;
    return { x: (el?.clientWidth ?? 0) / 2, y: (el?.clientHeight ?? 0) / 2 };
  }, [ref]);

  const zoomBy = useCallback(
    (factor) => setView((v) => zoomAt(v, center(), v.zoom * factor)),
    [center]
  );

  const resetZoom = useCallback(() => setView((v) => zoomAt(v, center(), 1)), [center]);

  return { view, setView, zoomBy, resetZoom };
}
