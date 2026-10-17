import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_URL } from "../config.js";
import { applyLive, applyOp, without } from "../lib/boardState.js";
import { throttle } from "../lib/throttle.js";

const ERROR_MESSAGES = {
  shape_limit_reached: "This board is full. Delete something or start a new board.",
  rate_limited: "You're drawing faster than the server accepts. Some changes were skipped.",
};

// Status: "connecting" → "joined" ⇄ "reconnecting"; or a terminal
// "not_found" | "full" | "error".
const TERMINAL = new Set(["not_found", "full", "error"]);

/**
 * Owns the socket for one board. Changes are applied locally at once
 * (optimistic) and sent to the server; while disconnected they are queued and
 * replayed after re-joining. Because shape ids are unique and the server
 * ignores duplicates, replaying is safe.
 */
export function useBoard(boardId, name) {
  const [status, setStatus] = useState("connecting");
  const [shapes, setShapes] = useState(() => new Map());
  const [users, setUsers] = useState(() => new Map());
  const [self, setSelf] = useState(null);
  const [cursors, setCursors] = useState(() => new Map());
  const [live, setLive] = useState(() => new Map());
  const [notice, setNotice] = useState(null);
  const [remoteClears, setRemoteClears] = useState(0);

  const socketRef = useRef(null);
  const joinedRef = useRef(false);
  const queueRef = useRef([]);
  const nameRef = useRef(name);
  const joinRef = useRef(() => {});

  const send = useCallback((event, payload) => {
    const socket = socketRef.current;
    if (!socket || !joinedRef.current) {
      queueRef.current.push({ event, payload });
      return;
    }
    socket.timeout(10_000).emit(event, payload, (err, res) => {
      if (err) {
        // Lost connection or timed out: retry after the next join.
        queueRef.current.push({ event, payload });
        return;
      }
      if (res.ok) return;
      if (event === "shape:add") {
        // Roll back what the server did not store so we don't diverge.
        const kept = new Set(res.added ?? []);
        const rejected = payload.shapes.filter((s) => !kept.has(s.id)).map((s) => s.id);
        setShapes((prev) => applyOp(prev, "shape:delete", { ids: rejected }));
      }
      setNotice(ERROR_MESSAGES[res.error] ?? "The server rejected a change.");
    });
  }, []);

  useEffect(() => {
    const socket = io(API_URL, { reconnectionDelayMax: 10_000 });
    socketRef.current = socket;

    const join = () => {
      socket.timeout(20_000).emit("board:join", { boardId, name: nameRef.current }, (err, res) => {
        if (err) {
          if (socket.connected) setTimeout(join, 2000);
          return;
        }
        if (!res.ok) {
          joinedRef.current = false;
          setStatus(
            res.error === "not_found" ? "not_found" : res.error === "board_full" ? "full" : "error"
          );
          socket.disconnect();
          return;
        }
        const queued = queueRef.current;
        queueRef.current = [];
        let next = new Map(res.shapes.map((s) => [s.id, s]));
        for (const q of queued) next = applyOp(next, q.event, q.payload);
        setShapes(next);
        setUsers(new Map(res.users.map((u) => [u.id, u])));
        setSelf(res.self);
        setCursors(new Map());
        setLive(new Map());
        joinedRef.current = true;
        setStatus("joined");
        queued.forEach((q) => send(q.event, q.payload));
      });
    };
    joinRef.current = join;

    // Rooms are server-side and forgotten on disconnect, so join again on
    // every (re)connect and take the server's state as the new baseline.
    socket.on("connect", join);
    socket.on("disconnect", () => {
      joinedRef.current = false;
      setStatus((s) => (TERMINAL.has(s) || s === "connecting" ? s : "reconnecting"));
    });

    socket.on("shape:add", ({ shapes: added }) => {
      setShapes((prev) => applyOp(prev, "shape:add", { shapes: added }));
      const ids = new Set(added.map((s) => s.id));
      setLive((prev) => {
        const done = [...prev].filter(([, s]) => ids.has(s.id));
        return done.length ? new Map([...prev].filter(([, s]) => !ids.has(s.id))) : prev;
      });
    });
    socket.on("shape:delete", ({ ids }) => {
      setShapes((prev) => applyOp(prev, "shape:delete", { ids }));
    });
    socket.on("board:clear", () => {
      setShapes(new Map());
      setRemoteClears((n) => n + 1);
    });
    socket.on("presence:join", (user) => {
      setUsers((prev) => new Map(prev).set(user.id, user));
    });
    socket.on("presence:leave", ({ userId }) => {
      setUsers((prev) => without(prev, userId));
      setCursors((prev) => without(prev, userId));
      setLive((prev) => without(prev, userId));
    });
    socket.on("cursor:move", ({ userId, x, y }) => {
      setCursors((prev) => new Map(prev).set(userId, { x, y }));
    });
    socket.on("stroke:live", ({ userId, stroke }) => {
      setLive((prev) => applyLive(prev, userId, stroke));
    });
    socket.on("stroke:end", ({ userId, id }) => {
      setLive((prev) => (prev.get(userId)?.id === id ? without(prev, userId) : prev));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      joinedRef.current = false;
      queueRef.current = [];
    };
  }, [boardId, send]);

  const addShapes = useCallback(
    (list) => {
      setShapes((prev) => applyOp(prev, "shape:add", { shapes: list }));
      send("shape:add", { shapes: list });
    },
    [send]
  );

  const deleteShapes = useCallback(
    (ids) => {
      setShapes((prev) => applyOp(prev, "shape:delete", { ids }));
      send("shape:delete", { ids });
    },
    [send]
  );

  const clear = useCallback(() => {
    setShapes(new Map());
    send("board:clear", {});
  }, [send]);

  // Ephemeral messages: only sent while joined, never queued.
  const volatile = useCallback((event, payload) => {
    if (joinedRef.current) socketRef.current?.volatile.emit(event, payload);
  }, []);

  // volatile() reads refs only when the throttled function is called, not during render.
  // eslint-disable-next-line react-hooks/refs
  const sendCursor = useMemo(() => throttle((p) => volatile("cursor:move", p), 50), [volatile]);
  const sendLive = useCallback((stroke) => volatile("stroke:live", stroke), [volatile]);
  const endLive = useCallback(
    (id) => {
      if (joinedRef.current) socketRef.current?.emit("stroke:end", { id });
    },
    []
  );

  const rename = useCallback((newName) => {
    nameRef.current = newName;
    if (joinedRef.current) joinRef.current();
  }, []);

  return {
    status,
    shapes,
    users,
    self,
    cursors,
    live,
    notice,
    remoteClears,
    dismissNotice: useCallback(() => setNotice(null), []),
    addShapes,
    deleteShapes,
    clear,
    sendCursor,
    sendLive,
    endLive,
    rename,
  };
}
