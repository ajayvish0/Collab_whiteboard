import { but } from "../utils/logo.js";

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
    <div className="fixed top-5 left-10 flex flex-col w-[60px] h-[80vh] justify-between items-center py-5 bg-zinc-100 rounded-xl drop-shadow-2xl z-50">
      <div className="flex flex-col gap-6">
        {but.map((t) => (
          <button
            key={t.name}
            className={`w-10 h-10 flex items-center justify-center rounded-full ${
              tool === t.name ? "bg-blue-500" : "bg-gray-200"
            }`}
            onClick={() => setTool(t.name)}
          >
            <img src={t.src} alt={t.name} className="w-6 h-6" />
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-4 items-center">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-10 rounded-lg cursor-pointer"
        />
        <input
          type="range"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-full"
        />
        <button
          className="px-3 py-2 rounded-lg hover:bg-red-600 bg-red-500 text-white text-sm"
          onClick={handleClear}
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
