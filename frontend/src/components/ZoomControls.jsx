export const ZoomControls = ({ zoom, setZoom }) => {
  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-2 flex items-center">
      <button
        onClick={() => setZoom((prev) => Math.max(0.1, prev - 0.1))}
        className="p-1 hover:bg-gray-100 rounded"
      >
        -
      </button>
      <span className="mx-2">{Math.round(zoom * 100)}%</span>
      <button
        onClick={() => setZoom((prev) => Math.min(5, prev + 0.1))}
        className="p-1 hover:bg-gray-100 rounded"
      >
        +
      </button>
    </div>
  );
};
