import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import CanvasDrawing from "./CanvasDrawing";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CanvasDrawing />} />
        <Route path="/session/:sessionId" element={<CanvasDrawing />} />
      </Routes>
    </Router>
  );
}

export default App;
