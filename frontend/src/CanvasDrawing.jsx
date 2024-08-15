//https://collab-whiteboard-5uu2.onrender.com ==> use for deployment

import { useEffect, useRef, useReducer } from "react";
import Toolbar from "./components/Toolbar";
import io from "socket.io-client";
import { useParams } from "react-router-dom";

// Initialize socket connection
const socket = io("https://collab-whiteboard-5uu2.onrender.com", {
  withCredentials: true,
});

// Reducer function to manage drawing-related states
const drawingReducer = (state, action) => {
  switch (action.type) {
    case "START_DRAWING":
      return {
        ...state,
        isDrawing: true,
        startPosition: action.point,
        currentShape: action.currentShape,
        currentPath: action.currentPath,
      };
    case "DRAW":
      return {
        ...state,
        currentPath: action.currentPath,
        currentShape: action.currentShape,
      };
    case "STOP_DRAWING":
      return {
        ...state,
        isDrawing: false,
        currentPath: null,
        currentShape: null,
        startPosition: null,
      };
    case "SET_PATHS":
      return { ...state, paths: action.paths };
    case "SET_TOOL":
      return { ...state, tool: action.tool };
    case "SET_COLOR":
      return { ...state, color: action.color };
    case "SET_STROKE_WIDTH":
      return { ...state, strokeWidth: action.strokeWidth };
    case "SET_TEXT":
      return { ...state, text: action.text };
    default:
      return state;
  }
};

const CanvasDrawing = () => {
  const svgRef = useRef(null);
  const { sessionId } = useParams();

  const initialState = {
    isDrawing: false,
    currentPath: null,
    paths: [],
    tool: "pencil",
    color: "#000000",
    strokeWidth: 2,
    startPosition: null,
    currentShape: null,
    text: "",
  };

  const [state, dispatch] = useReducer(drawingReducer, initialState);

  useEffect(() => {
    socket.emit("join-session", sessionId);

    socket.on("draw", (newPath) => {
      dispatch({ type: "SET_PATHS", paths: [...state.paths, newPath] });
    });

    socket.on("clear", () => {
      dispatch({ type: "SET_PATHS", paths: [] });
    });

    socket.on("load-canvas", (loadedPaths) => {
      dispatch({ type: "SET_PATHS", paths: loadedPaths });
    });

    return () => {
      socket.off("draw");
      socket.off("clear");
      socket.off("load-canvas");
    };
  }, [sessionId, state.paths]);

  const startDrawing = (e) => {
    const point = getCoordinates(e);
    const currentShape = ["rectangle", "circle", "text"].includes(state.tool)
      ? { x: point.x, y: point.y, width: 0, height: 0 }
      : null;
    const currentPath = !currentShape ? `M ${point.x} ${point.y}` : null;

    dispatch({ type: "START_DRAWING", point, currentShape, currentPath });
  };

  const draw = (e) => {
    if (!state.isDrawing) return;
    const point = getCoordinates(e);

    if (["rectangle", "circle"].includes(state.tool)) {
      const width = point.x - state.startPosition.x;
      const height = point.y - state.startPosition.y;
      const currentShape = {
        x: width < 0 ? point.x : state.startPosition.x,
        y: height < 0 ? point.y : state.startPosition.y,
        width: Math.abs(width),
        height: Math.abs(height),
        rx: state.tool === "rectangle" ? 10 : Math.abs(width / 2),
        ry: state.tool === "rectangle" ? 10 : Math.abs(height / 2),
      };
      dispatch({ type: "DRAW", currentShape });
    } else {
      const currentPath = `${state.currentPath} L ${point.x} ${point.y}`;
      dispatch({ type: "DRAW", currentPath });
    }
  };

  const stopDrawing = () => {
    if (!state.isDrawing) return;
    if (["rectangle", "circle"].includes(state.tool) && state.currentShape) {
      const newPath = {
        ...state.currentShape,
        stroke: state.color,
        strokeWidth: state.strokeWidth,
        tool: state.tool,
      };
      dispatch({ type: "SET_PATHS", paths: [...state.paths, newPath] });
      socket.emit("draw", { sessionId, path: newPath });
    } else if (state.tool === "text" && state.text && state.currentShape) {
      const newPath = {
        x: state.currentShape.x,
        y: state.currentShape.y,
        text: state.text,
        color: state.color,
        tool: state.tool,
      };
      dispatch({ type: "SET_PATHS", paths: [...state.paths, newPath] });
      dispatch({ type: "SET_TEXT", text: "" });
      socket.emit("draw", { sessionId, path: newPath });
    } else if (state.currentPath) {
      const newPath = {
        d: state.currentPath,
        stroke: state.color,
        strokeWidth: state.strokeWidth,
        tool: state.tool,
      };
      dispatch({ type: "SET_PATHS", paths: [...state.paths, newPath] });
      socket.emit("draw", { sessionId, path: newPath });
    }

    dispatch({ type: "STOP_DRAWING" });
  };

  const getCoordinates = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  const handleClear = () => {
    dispatch({ type: "SET_PATHS", paths: [] });
    socket.emit("clear", sessionId);
  };

  const renderPath = (path, index) => {
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
  };

  return (
    <div className="flex flex-col h-screen">
      <Toolbar
        tool={state.tool}
        setTool={(tool) => dispatch({ type: "SET_TOOL", tool })}
        color={state.color}
        setColor={(color) => dispatch({ type: "SET_COLOR", color })}
        strokeWidth={state.strokeWidth}
        setStrokeWidth={(strokeWidth) =>
          dispatch({ type: "SET_STROKE_WIDTH", strokeWidth })
        }
        handleClear={handleClear}
      />
      {state.tool === "text" && (
        <div className="p-4">
          <input
            type="text"
            value={state.text}
            onChange={(e) =>
              dispatch({ type: "SET_TEXT", text: e.target.value })
            }
            placeholder="Enter text"
            className="px-4 py-2 border border-gray-300"
          />
        </div>
      )}

      <svg
        ref={svgRef}
        className="flex-grow border border-gray-300"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      >
        {state.paths.map(renderPath)}
        {state.currentPath && (
          <path
            d={state.currentPath}
            stroke={state.tool === "eraser" ? "#FFFFFF" : state.color}
            strokeWidth={state.strokeWidth}
            fill="none"
          />
        )}
        {state.currentShape &&
          ["rectangle", "circle"].includes(state.tool) &&
          (state.tool === "rectangle" ? (
            <rect
              x={state.currentShape.x}
              y={state.currentShape.y}
              width={state.currentShape.width}
              height={state.currentShape.height}
              rx={state.currentShape.rx}
              ry={state.currentShape.ry}
              stroke={state.color}
              strokeWidth={state.strokeWidth}
              fill="none"
            />
          ) : (
            <ellipse
              cx={state.currentShape.x + state.currentShape.width / 2}
              cy={state.currentShape.y + state.currentShape.height / 2}
              rx={state.currentShape.width / 2}
              ry={state.currentShape.height / 2}
              stroke={state.color}
              strokeWidth={state.strokeWidth}
              fill="none"
            />
          ))}
        {state.currentShape && state.tool === "text" && (
          <text
            x={state.currentShape.x}
            y={state.currentShape.y}
            fill={state.color}
            fontSize={`${state.strokeWidth * 5}px`}
          >
            {state.text}
          </text>
        )}
      </svg>
    </div>
  );
};

export default CanvasDrawing;
