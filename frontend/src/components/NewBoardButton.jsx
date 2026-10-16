import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { createBoard } from "../lib/api.js";

// After this long without a response, explain the free-tier cold start.
const SLOW_MS = 2500;

export default function NewBoardButton({ className = "", children = "New board" }) {
  const navigate = useNavigate();
  const [state, setState] = useState("idle"); // idle | loading | slow | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (state !== "loading") return;
    const t = setTimeout(() => setState("slow"), SLOW_MS);
    return () => clearTimeout(t);
  }, [state]);

  const start = async () => {
    setState("loading");
    setError("");
    try {
      const id = await createBoard();
      navigate(`/board/${id}`);
    } catch (err) {
      setError(err.message);
      setState("error");
    }
  };

  const busy = state === "loading" || state === "slow";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={`rounded-xl bg-blue-600 px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70 ${className}`}
      >
        {busy ? "Creating board…" : children}
      </button>
      <p className="min-h-5 max-w-sm text-center text-sm text-zinc-600" role="status" aria-live="polite">
        {state === "slow" && "Waking up the server. On free hosting this can take up to a minute."}
        {state === "error" && <span className="text-red-600">{error}</span>}
      </p>
    </div>
  );
}

NewBoardButton.propTypes = { className: PropTypes.string, children: PropTypes.node };
