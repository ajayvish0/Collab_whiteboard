import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";

import Board from "./components/Board.jsx";
import BoardMessage from "./components/BoardMessage.jsx";
import Landing from "./components/Landing.jsx";

// Links from the first version of the app used /session/<id>.
function LegacySessionRedirect() {
  const { boardId } = useParams();
  return <Navigate to={`/board/${boardId}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/board/:boardId" element={<Board />} />
        <Route path="/session/:boardId" element={<LegacySessionRedirect />} />
        <Route path="*" element={<BoardMessage kind="page" />} />
      </Routes>
    </BrowserRouter>
  );
}
