import { useRef, useState, useEffect } from "react";
import io from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
const socket = io("http://localhost:3000");
const CanvasDrawing = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState(null);
  const [paths, setPaths] = useState([]);
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);

  useEffect(() => {
    if (!sessionId) {
      createNewSession();
    } else {
      joinSession(sessionId);
    }

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

  const createNewSession = async () => {
    const response = await fetch("http://localhost:3000/create-session", {
      method: "POST",
    });
    const data = await response.json();
    navigate(`/session/${data.sessionId}`);
  };

  const joinSession = (sessionId) => {
    socket.emit("join-session", sessionId);
  };
  const startDrawing = (e) => {
    const point = getCoordinates(e);
    setCurrentPath(`M ${point.x} ${point.y}`);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const point = getCoordinates(e);
    setCurrentPath((prevPath) => `${prevPath} L ${point.x} ${point.y}`);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      if (currentPath) {
        const newPath = { d: currentPath, stroke: color, strokeWidth, tool };
        setPaths((prevPaths) => [
          ...prevPaths,
          { d: currentPath, stroke: color, strokeWidth, tool },
        ]);
        socket.emit("draw", { sessionId, path: newPath });
        setCurrentPath(null);
      }
    }
  };

  const getCoordinates = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const handleClear = () => {
    setPaths([]);
    socket.emit("clear", sessionId);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex justify-between items-center p-4 bg-gray-100">
        <div>
          <button
            className={`px-4 py-2 mr-2 ${
              tool === "pencil" ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={() => setTool("pencil")}
          >
            Pencil
          </button>
          <button
            className={`px-4 py-2 mr-2 ${
              tool === "eraser" ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={() => setTool("eraser")}
          >
            Eraser
          </button>
        </div>
        <div>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="mr-2"
          />
          <input
            type="range"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="mr-2"
          />
          <button
            className="px-4 py-2 bg-red-500 text-white"
            onClick={handleClear}
          >
            Clear
          </button>
        </div>
      </div>
      <svg
        ref={svgRef}
        className="flex-grow"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      >
        {paths.map((path, index) => (
          <path
            key={index}
            d={path.d}
            stroke={path.tool === "eraser" ? "white" : path.stroke}
            strokeWidth={path.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {currentPath && (
          <path
            d={currentPath}
            stroke={tool === "eraser" ? "white" : color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
};

export default CanvasDrawing;
