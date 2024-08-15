// App.js

import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import "dotenv/config";
import Share from "./components/Share";
import CanvasDrawing from "./CanvasDrawing";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Share />} />
        <Route path="/session/:sessionId" element={<CanvasDrawing />} />
      </Routes>
    </Router>
  );
}

export default App;
