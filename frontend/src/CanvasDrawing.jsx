import { useEffect, useRef, useCallback } from "react";
import {
  colorState,
  currentPathState,
  currentShapeState,
  isDrawingState,
  pathsState,
  startPositionState,
  strokeWidthState,
  textState,
  toolState,
} from "./atoms/recoil";
import Toolbar from "./components/Toolbar";
import { useRecoilState } from "recoil";
import io from "socket.io-client";
import { useParams } from "react-router-dom";
// "https://collab-whiteboard-5uu2.onrender.com"
// Initialize socket connection
const socket = io("https://collab-whiteboard-5uu2.onrender.com", {
  withCredentials: true,
});

const CanvasDrawing = () => {
  const svgRef = useRef(null);
  const { sessionId } = useParams();

  const [isDrawing, setIsDrawing] = useRecoilState(isDrawingState);
  const [currentPath, setCurrentPath] = useRecoilState(currentPathState);
  const [paths, setPaths] = useRecoilState(pathsState);
  const [tool, setTool] = useRecoilState(toolState);
  const [color, setColor] = useRecoilState(colorState);
  const [strokeWidth, setStrokeWidth] = useRecoilState(strokeWidthState);
  const [startPosition, setStartPosition] = useRecoilState(startPositionState);
  const [currentShape, setCurrentShape] = useRecoilState(currentShapeState);
  const [text, setText] = useRecoilState(textState);

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
  }, [sessionId, setPaths]);

  const startDrawing = useCallback(
    (e) => {
      const point = getCoordinates(e);
      setIsDrawing(true);
      setStartPosition(point);

      if (["rectangle", "circle", "text"].includes(tool)) {
        setCurrentShape({ x: point.x, y: point.y, width: 0, height: 0 });
      } else {
        setCurrentPath(`M ${point.x} ${point.y}`);
      }
    },
    [tool, setIsDrawing, setStartPosition, setCurrentShape, setCurrentPath]
  );

  const draw = useCallback(
    (e) => {
      if (!isDrawing) return;
      const point = getCoordinates(e);

      if (["rectangle", "circle"].includes(tool)) {
        const width = point.x - startPosition.x;
        const height = point.y - startPosition.y;
        setCurrentShape({
          x: width < 0 ? point.x : startPosition.x,
          y: height < 0 ? point.y : startPosition.y,
          width: Math.abs(width),
          height: Math.abs(height),
          rx: tool === "rectangle" ? 10 : Math.abs(width / 2),
          ry: tool === "rectangle" ? 10 : Math.abs(height / 2),
        });
      } else {
        setCurrentPath((prev) => `${prev} L ${point.x} ${point.y}`);
      }
    },
    [isDrawing, tool, startPosition, setCurrentShape, setCurrentPath]
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    let newPath;
    if (["rectangle", "circle"].includes(tool) && currentShape) {
      newPath = {
        ...currentShape,
        stroke: color,
        strokeWidth,
        tool,
      };
    } else if (tool === "text" && text && currentShape) {
      newPath = {
        x: currentShape.x,
        y: currentShape.y,
        text,
        color,
        tool,
      };
      setText("");
    } else if (currentPath) {
      newPath = {
        d: currentPath,
        stroke: color,
        strokeWidth,
        tool,
      };
    }

    if (newPath) {
      setPaths((prevPaths) => [...prevPaths, newPath]);
      socket.emit("draw", { sessionId, path: newPath });
    }

    setCurrentPath(null);
    setCurrentShape(null);
    setStartPosition(null);
  }, [
    isDrawing,
    tool,
    currentShape,
    currentPath,
    color,
    strokeWidth,
    text,
    sessionId,
    setPaths,
    setIsDrawing,
    setCurrentPath,
    setCurrentShape,
    setStartPosition,
    setText,
  ]);

  const getCoordinates = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  const handleClear = () => {
    setPaths([]);
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
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        handleClear={handleClear}
      />
      {tool === "text" && (
        <div className="p-4">
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
        className="flex-grow border border-gray-300"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      >
        {paths.map(renderPath)}
        {currentPath && (
          <path
            d={currentPath}
            stroke={tool === "eraser" ? "#FFFFFF" : color}
            strokeWidth={strokeWidth}
            fill="none"
          />
        )}
        {currentShape &&
          ["rectangle", "circle"].includes(tool) &&
          (tool === "rectangle" ? (
            <rect
              x={currentShape.x}
              y={currentShape.y}
              width={currentShape.width}
              height={currentShape.height}
              rx={currentShape.rx}
              ry={currentShape.ry}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
            />
          ) : (
            <ellipse
              cx={currentShape.x + currentShape.width / 2}
              cy={currentShape.y + currentShape.height / 2}
              rx={currentShape.width / 2}
              ry={currentShape.height / 2}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
            />
          ))}
        {currentShape && tool === "text" && (
          <text
            x={currentShape.x}
            y={currentShape.y}
            fill={color}
            fontSize={`${strokeWidth * 5}px`}
          >
            {text}
          </text>
        )}
      </svg>
    </div>
  );
};

export default CanvasDrawing;
