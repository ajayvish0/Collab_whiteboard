import NewBoardButton from "./NewBoardButton.jsx";

const FEATURES = [
  ["No sign-up", "Create a board and share the link. Anyone with it can draw."],
  ["Real time", "See strokes, shapes and cursors as others draw them."],
  ["Saved", "Boards are stored on the server and survive restarts."],
  ["Any device", "Mouse, touch and pen. Pinch to zoom on phones and tablets."],
];

export default function Landing() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 py-16">
      <div className="flex max-w-2xl flex-col items-center text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">TeamSketch</h1>
        <p className="mt-4 text-lg text-zinc-600">
          A shared whiteboard for sketching ideas together, right now.
        </p>
        <div className="mt-8">
          <NewBoardButton />
        </div>
      </div>
      <ul className="mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
        {FEATURES.map(([title, text]) => (
          <li key={title} className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold text-zinc-900">{title}</h2>
            <p className="mt-1 text-sm text-zinc-600">{text}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
