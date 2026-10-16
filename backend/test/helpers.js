import { io as ioClient } from "socket.io-client";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/logger.js";
import { createMemoryStore } from "../src/store/memoryStore.js";

export async function startServer({ env = {}, store = createMemoryStore() } = {}) {
  const config = loadConfig({ SAVE_DEBOUNCE_MS: "20", ...env });
  const server = createApp({ config, store, logger: createLogger("silent") });
  const port = await server.start(0);
  const url = `http://localhost:${port}`;
  const clients = [];

  return {
    server,
    store,
    url,
    async createBoard() {
      const res = await fetch(`${url}/boards`, { method: "POST" });
      return (await res.json()).boardId;
    },
    connect(opts = {}) {
      const socket = ioClient(url, { transports: ["websocket"], forceNew: true, ...opts });
      clients.push(socket);
      return socket;
    },
    async close() {
      clients.forEach((c) => c.disconnect());
      await server.close();
    },
  };
}

export function emit(socket, event, payload) {
  return socket.timeout(2000).emitWithAck(event, payload);
}

export function waitFor(socket, event, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

export function connected(socket) {
  return socket.connected ? Promise.resolve() : waitFor(socket, "connect");
}

/** Collects every payload received for `event`. */
export function record(socket, event) {
  const seen = [];
  socket.on(event, (data) => seen.push(data));
  return seen;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0;
export function pencil(overrides = {}) {
  n++;
  return {
    id: `shape-${n}`,
    type: "pencil",
    style: { stroke: "#000000", strokeWidth: 2 },
    points: [
      [0, 0],
      [10, 10],
    ],
    ...overrides,
  };
}
