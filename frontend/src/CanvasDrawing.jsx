import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Toolbar from "./components/Toolbar";
import io from "socket.io-client";
import { useParams } from "react-router-dom";
import { ZoomControls } from "./components/ZoomControls";

const socket = io("https://collab-whiteboard-5uu2.onrender.com", {
  withCredentials: true,
});

const CanvasDrawing = () => {
  const svgRef = useRef(null);
  const { sessionId } = useParams();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drawingState, setDrawingState] = useState({
    isDrawing: false,
    currentPath: null,
    currentShape: null,
    startPosition: null,
  });

  const [paths, setPaths] = useState([]);
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [text, setText] = useState("");

  useEffect(() => {
    socket.emit("join-session", sessionId);

    socket.on("draw", (newPath) => {
      setPaths((prevPaths) => [...prevPaths, newPath]);
    });

    socket.on("clear", () => {
      setPaths([]);
    });

    socket.on("load-canvas", (loadedPaths) => {
      setPaths(loadedPaths);
    });

    return () => {
      socket.off("draw");
      socket.off("clear");
      socket.off("load-canvas");
    };
  }, [sessionId]);

  const getCoordinates = useCallback(
    (e) => {
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      return { x, y };
    },
    [zoom, pan]
  );

  const startDrawing = useCallback(
    (e) => {
      const point = getCoordinates(e);
      setDrawingState((prev) => ({
        ...prev,
        isDrawing: true,
        startPosition: point,
        currentPath: ["rectangle", "circle", "text"].includes(tool)
          ? null
          : `M ${point.x} ${point.y}`,
        currentShape: ["rectangle", "circle", "text"].includes(tool)
          ? { x: point.x, y: point.y, width: 0, height: 0 }
          : null,
      }));
    },
    [tool, getCoordinates]
  );

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const mousePoint = getCoordinates(e);

      setZoom((prevZoom) => {
        const newZoom = Math.min(Math.max(0.1, prevZoom * delta), 5);
        return newZoom;
      });

      setPan((prevPan) => ({
        x: prevPan.x - mousePoint.x * (delta - 1) * zoom,
        y: prevPan.y - mousePoint.y * (delta - 1) * zoom,
      }));
    },
    [zoom, getCoordinates]
  );

  const draw = useCallback(
    (e) => {
      if (!drawingState.isDrawing) return;
      const point = getCoordinates(e);

      setDrawingState((prev) => {
        if (["rectangle", "circle"].includes(tool)) {
          const width = point.x - prev.startPosition.x;
          const height = point.y - prev.startPosition.y;
          return {
            ...prev,
            currentShape: {
              x: width < 0 ? point.x : prev.startPosition.x,
              y: height < 0 ? point.y : prev.startPosition.y,
              width: Math.abs(width),
              height: Math.abs(height),
              rx: tool === "rectangle" ? 10 : Math.abs(width / 2),
              ry: tool === "rectangle" ? 10 : Math.abs(height / 2),
            },
          };
        } else {
          return {
            ...prev,
            currentPath: `${prev.currentPath} L ${point.x} ${point.y}`,
          };
        }
      });
    },
    [drawingState.isDrawing, tool, getCoordinates]
  );

  const stopDrawing = useCallback(() => {
    if (!drawingState.isDrawing) return;

    let newPath;
    if (["rectangle", "circle"].includes(tool) && drawingState.currentShape) {
      newPath = {
        ...drawingState.currentShape,
        stroke: color,
        strokeWidth,
        tool,
      };
    } else if (tool === "text" && text && drawingState.currentShape) {
      newPath = {
        x: drawingState.currentShape.x,
        y: drawingState.currentShape.y,
        text,
        color,
        tool,
      };
      setText("");
    } else if (drawingState.currentPath) {
      newPath = {
        d: drawingState.currentPath,
        stroke: color,
        strokeWidth,
        tool,
      };
    }

    if (newPath) {
      setPaths((prevPaths) => [...prevPaths, newPath]);
      socket.emit("draw", { sessionId, path: newPath });
    }

    setDrawingState({
      isDrawing: false,
      currentPath: null,
      currentShape: null,
      startPosition: null,
    });
  }, [drawingState, tool, color, strokeWidth, text, sessionId]);

  const handleClear = useCallback(() => {
    setPaths([]);
    socket.emit("clear", sessionId);
  }, [sessionId]);

  const renderPath = useCallback((path, index) => {
    switch (path.tool) {
      case "pencil":
      case "eraser":
        return (
          <path
            key={index}
            d={path.d}
            stroke={path.tool === "eraser" ? "#FFFFFF" : path.stroke}
            strokeWidth={path.strokeWidth}
            fill="none"
          />
        );
      case "rectangle":
        return (
          <rect
            key={index}
            x={path.x}
            y={path.y}
            width={path.width}
            height={path.height}
            rx={path.rx}
            ry={path.ry}
            stroke={path.stroke}
            strokeWidth={path.strokeWidth}
            fill="none"
          />
        );
      case "circle":
        return (
          <ellipse
            key={index}
            cx={path.x + path.width / 2}
            cy={path.y + path.height / 2}
            rx={path.width / 2}
            ry={path.height / 2}
            stroke={path.stroke}
            strokeWidth={path.strokeWidth}
            fill="none"
          />
        );
      case "text":
        return (
          <text
            key={index}
            x={path.x}
            y={path.y}
            fill={path.color}
            fontSize={`${path.strokeWidth * 5}px`}
          >
            {path.text}
          </text>
        );
      default:
        return null;
    }
  }, []);

  const memoizedPaths = useMemo(
    () => paths.map(renderPath),
    [paths, renderPath]
  );

  return (
    <div className="relative h-screen  ">
      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        handleClear={handleClear}
      />

      <ZoomControls
        zoom={zoom}
        setZoom={setZoom}
        minZoom={0.1}
        maxZoom={5}
        zoomStep={0.1}
      />

      <div className=" w-full h-full">
        {tool === "text" && (
          <div className="absolute top-16 left-[100px] p-4 z-4">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text"
              className="px-4 py-2 border border-gray-300"
            />
          </div>
        )}
        <svg
          ref={svgRef}
          className="w-full h-full"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onWheel={handleWheel}
          style={{ cursor: tool === "text" ? "text" : "crosshair" }}
        >
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            {memoizedPaths}
            {drawingState.currentPath && (
              <path
                d={drawingState.currentPath}
                stroke={tool === "eraser" ? "#FFFFFF" : color}
                strokeWidth={strokeWidth}
                fill="none"
              />
            )}
            {drawingState.currentShape &&
              ["rectangle", "circle"].includes(tool) &&
              (tool === "rectangle" ? (
                <rect
                  x={drawingState.currentShape.x}
                  y={drawingState.currentShape.y}
                  width={drawingState.currentShape.width}
                  height={drawingState.currentShape.height}
                  rx={drawingState.currentShape.rx}
                  ry={drawingState.currentShape.ry}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
              ) : (
                <ellipse
                  cx={
                    drawingState.currentShape.x +
                    drawingState.currentShape.width / 2
                  }
                  cy={
                    drawingState.currentShape.y +
                    drawingState.currentShape.height / 2
                  }
                  rx={drawingState.currentShape.width / 2}
                  ry={drawingState.currentShape.height / 2}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
              ))}
            {drawingState.currentShape && tool === "text" && (
              <text
                x={drawingState.currentShape.x}
                y={drawingState.currentShape.y}
                fill={color}
                fontSize={`${strokeWidth * 5}px`}
              >
                {text}
              </text>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default CanvasDrawing;
