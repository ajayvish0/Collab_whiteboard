import { useRef, useState } from "react";

const CanvasDrawing = () => {
  const svgRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState(null);
  const [paths, setPaths] = useState([]);
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);

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
        setPaths((prevPaths) => [
          ...prevPaths,
          { d: currentPath, stroke: color, strokeWidth, tool },
        ]);
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
