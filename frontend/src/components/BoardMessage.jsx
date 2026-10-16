import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import NewBoardButton from "./NewBoardButton.jsx";

const MESSAGES = {
  not_found: {
    title: "This board doesn't exist",
    text: "The link may be mistyped, or the board expired after a long time without changes.",
  },
  full: {
    title: "This board is full",
    text: "Too many people are on this board right now. Try again later, or start your own.",
  },
  error: {
    title: "Something went wrong",
    text: "The server could not open this board. Try reloading the page.",
  },
  page: {
    title: "Page not found",
    text: "There is nothing at this address.",
  },
};

export default function BoardMessage({ kind }) {
  const m = MESSAGES[kind] ?? MESSAGES.error;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">{m.title}</h1>
      <p className="max-w-md text-zinc-600">{m.text}</p>
      <NewBoardButton>Create a new board</NewBoardButton>
      <Link to="/" className="text-sm text-blue-700 underline">
        Back to home
      </Link>
    </main>
  );
}

BoardMessage.propTypes = { kind: PropTypes.string.isRequired };
