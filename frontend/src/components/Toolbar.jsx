const Toolbar = ({
  tool,
  setTool,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  handleClear,
}) => {
  return (
    <div className="flex justify-between items-center p-4 bg-gray-100">
      <div>
        {["pencil", "eraser", "rectangle", "circle", "text"].map((t) => (
          <button
            key={t}
            className={`px-4 py-2 mr-2 ${
              tool === t ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={() => setTool(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
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
  );
};

export default Toolbar;
