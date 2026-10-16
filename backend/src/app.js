import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createServer } from "node:http";
import { Server } from "socket.io";

import { createBoardManager } from "./boards.js";
import { createTokenBucket } from "./rateLimiter.js";
import {
  addShapesSchema,
  cursorSchema,
  clearSchema,
  deleteShapesSchema,
  joinSchema,
  liveEndSchema,
  liveStrokeSchema,
  validate,
} from "./schemas.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Builds the HTTP + Socket.IO server without listening, so tests can start it
// on a random port and production code (server.js) can own the process.
export function createApp({ config, store, logger }) {
  const { limits } = config;
  const boards = createBoardManager({
    store,
    logger,
    saveDebounceMs: config.saveDebounceMs,
    maxShapesPerBoard: limits.maxShapesPerBoard,
    maxUsersPerBoard: limits.maxUsersPerBoard,
  });

  // ---------------------------------------------------------------- HTTP
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, methods: ["GET", "POST"] }));
  app.use(express.json({ limit: "10kb" }));

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok", store: store.kind, activeBoards: boards.activeCount });
  });

  const createLimiter = rateLimit({
    windowMs: limits.createBoardWindowMs,
    limit: limits.createBoardMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "rate_limited" },
  });

  app.post("/boards", createLimiter, async (_req, res, next) => {
    try {
      const boardId = await boards.create();
      logger.info("board created", { boardId });
      res.status(201).json({ boardId });
    } catch (err) {
      next(err);
    }
  });

  app.use((_req, res) => res.status(404).json({ error: "not_found" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger.error("http error", { err: err.message });
    res.status(500).json({ error: "internal_error" });
  });

  // ----------------------------------------------------------- Socket.IO
  const httpServer = createServer(app);
  const allowedOrigins = new Set(config.corsOrigins);
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, methods: ["GET", "POST"] },
    maxHttpBufferSize: limits.maxMessageBytes,
    // Browsers always send Origin on WebSocket handshakes, so reject foreign
    // sites (cross-site WebSocket hijacking). Non-browser clients send none.
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      callback(null, !origin || allowedOrigins.has(origin));
    },
  });

  io.on("connection", (socket) => {
    const bucket = createTokenBucket({
      capacity: limits.socketBurst,
      ratePerSec: limits.socketRatePerSec,
    });
    let board = null;
    let user = null;

    // Wraps a handler with rate limiting, validation, "must have joined" and
    // error handling. Handlers return the value for the acknowledgement.
    const on = (event, schema, handler, { requiresBoard = true } = {}) => {
      socket.on(event, async (payload, ack) => {
        const reply = typeof ack === "function" ? ack : () => {};
        if (!bucket.take()) return reply({ ok: false, error: "rate_limited" });
        if (requiresBoard && !board) return reply({ ok: false, error: "not_joined" });
        const parsed = validate(schema, payload);
        if (!parsed.ok) return reply({ ok: false, error: parsed.error });
        try {
          reply((await handler(parsed.data)) ?? { ok: true });
        } catch (err) {
          logger.error("socket handler failed", { event, err: err.message });
          reply({ ok: false, error: "internal_error" });
        }
      });
    };

    const leaveCurrent = async () => {
      if (!board) return;
      const left = board;
      board = null;
      socket.leave(left.id);
      socket.to(left.id).emit("presence:leave", { userId: socket.id });
      await boards.leave(left, socket.id);
    };

    on(
      "board:join",
      joinSchema,
      async ({ boardId, name }) => {
        await leaveCurrent();
        const found = await boards.open(boardId);
        if (!found) return { ok: false, error: "not_found" };
        const joined = boards.join(found, socket.id, name);
        if (joined.error) {
          // open() may have loaded the board just for us.
          await boards.leave(found, socket.id);
          return { ok: false, error: joined.error };
        }
        board = found;
        user = joined.user;
        socket.join(board.id);
        socket.to(board.id).emit("presence:join", user);
        return {
          ok: true,
          self: user,
          users: [...board.members.values()],
          shapes: [...board.shapes.values()],
        };
      },
      { requiresBoard: false }
    );

    on("shape:add", addShapesSchema, ({ shapes }) => {
      const { added, error } = boards.addShapes(board, shapes, socket.id);
      // `socket.to` excludes the sender, which already has the shapes.
      if (added.length) socket.to(board.id).emit("shape:add", { shapes: added });
      return error ? { ok: false, error, added: added.map((s) => s.id) } : { ok: true };
    });

    on("shape:delete", deleteShapesSchema, ({ ids }) => {
      const deleted = boards.deleteShapes(board, ids);
      if (deleted.length) socket.to(board.id).emit("shape:delete", { ids: deleted });
      return { ok: true, deleted };
    });

    on("board:clear", clearSchema, () => {
      boards.clear(board);
      socket.to(board.id).emit("board:clear", { by: user.id });
    });

    // Ephemeral events: relayed, never stored. Volatile emits are dropped
    // rather than queued if a receiver is not ready.
    on("stroke:live", liveStrokeSchema, (stroke) => {
      socket.to(board.id).volatile.emit("stroke:live", { userId: socket.id, stroke });
    });

    on("stroke:end", liveEndSchema, ({ id }) => {
      socket.to(board.id).emit("stroke:end", { userId: socket.id, id });
    });

    on("cursor:move", cursorSchema, ({ x, y }) => {
      socket.to(board.id).volatile.emit("cursor:move", { userId: socket.id, x, y });
    });

    socket.on("disconnect", () => {
      leaveCurrent().catch((err) =>
        logger.error("leave failed", { err: err.message })
      );
    });
  });

  // ------------------------------------------------------------ lifecycle
  const ttlMs = limits.boardTtlDays * DAY_MS;
  let cleanupTimer = null;

  return {
    app,
    io,
    httpServer,
    boards,

    async start(port = config.port) {
      await store.init();
      await new Promise((resolve) => httpServer.listen(port, resolve));
      if (ttlMs > 0 && config.cleanupIntervalMs > 0) {
        cleanupTimer = setInterval(() => {
          boards.purgeExpired(ttlMs).catch((err) =>
            logger.error("purge failed", { err: err.message })
          );
        }, config.cleanupIntervalMs);
        cleanupTimer.unref();
      }
      return httpServer.address().port;
    },

    async close() {
      clearInterval(cleanupTimer);
      await new Promise((resolve) => io.close(() => resolve()));
      await boards.flushAll();
      await store.close();
    },
  };
}
