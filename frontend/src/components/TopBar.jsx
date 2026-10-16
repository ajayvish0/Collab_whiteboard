import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Icon } from "./icons.jsx";

const STATUS = {
  connecting: { label: "Connecting…", dot: "bg-amber-400 animate-pulse" },
  joined: { label: "Live", dot: "bg-green-500" },
  reconnecting: { label: "Reconnecting…", dot: "bg-amber-400 animate-pulse" },
};

const userShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
});

export default function TopBar({ status, users, self, onRename, onExport }) {
  const s = STATUS[status] ?? STATUS.connecting;
  const others = users.filter((u) => u.id !== self?.id);

  return (
    <>
      <Link
        to="/"
        className="fixed top-3 left-3 z-20 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
      >
        TeamSketch
      </Link>

      <div className="fixed top-3 right-3 z-20 flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 shadow-sm"
          role="status"
          aria-live="polite"
        >
          <span className={`h-2 w-2 rounded-full ${s.dot}`} />
          {s.label}
        </div>

        <div className="hidden items-center -space-x-2 sm:flex" aria-label={`${users.length} people on this board`}>
          {others.slice(0, 4).map((u) => (
            <Avatar key={u.id} user={u} />
          ))}
          {others.length > 4 && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-zinc-200 text-xs text-zinc-700">
              +{others.length - 4}
            </span>
          )}
        </div>

        {self && (
          <button
            type="button"
            onClick={() => {
              const name = window.prompt("Your display name", self.name)?.trim().slice(0, 32);
              if (name && name !== self.name) onRename(name);
            }}
            className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white py-1 pr-3 pl-1 text-xs text-zinc-700 shadow-sm hover:bg-zinc-50"
            title="Change your display name"
          >
            <Avatar user={self} small />
            <span className="hidden max-w-28 truncate sm:inline">{self.name} (you)</span>
          </button>
        )}

        <ExportMenu onExport={onExport} />
        <ShareButton />
      </div>
    </>
  );
}

TopBar.propTypes = {
  status: PropTypes.string.isRequired,
  users: PropTypes.arrayOf(userShape).isRequired,
  self: userShape,
  onRename: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
};

function Avatar({ user, small = false }) {
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      title={user.name}
      className={`flex items-center justify-center rounded-full border-2 border-white font-medium text-white ${small ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"}`}
      style={{ background: user.color }}
    >
      {initials}
    </span>
  );
}

Avatar.propTypes = { user: userShape.isRequired, small: PropTypes.bool };

function ShareButton() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link to share the board:", url);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
    >
      <Icon name={copied ? "check" : "link"} className="h-4 w-4" />
      <span className="hidden sm:inline">{copied ? "Link copied" : "Share"}</span>
      <span className="sr-only sm:hidden">{copied ? "Link copied" : "Copy share link"}</span>
    </button>
  );
}

function ExportMenu({ onExport }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (format) => {
    setOpen(false);
    onExport(format);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
        title="Export"
        aria-label="Export board"
      >
        <Icon name="download" className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-36 rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-lg">
          <button role="menuitem" type="button" className="w-full rounded px-2 py-1.5 text-left hover:bg-zinc-100" onClick={() => choose("png")}>
            Export PNG
          </button>
          <button role="menuitem" type="button" className="w-full rounded px-2 py-1.5 text-left hover:bg-zinc-100" onClick={() => choose("svg")}>
            Export SVG
          </button>
        </div>
      )}
    </div>
  );
}

ExportMenu.propTypes = { onExport: PropTypes.func.isRequired };
