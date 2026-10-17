// All runtime configuration comes from environment variables, with defaults
// that work for local development.

function int(value, fallback) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

function list(value, fallback) {
  if (!value) return fallback;
  return value
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function loadConfig(env = process.env) {
  return {
    port: int(env.PORT, 3000),
    corsOrigins: list(env.CORS_ORIGINS, ["http://localhost:5173", "https://collaoboard.netlify.app"]),
    databaseUrl: env.DATABASE_URL || null,
    // Number of reverse proxies in front of the app (Render uses one), so that
    // rate limiting sees the real client IP.
    trustProxy: int(env.TRUST_PROXY, env.RENDER ? 1 : 0),
    logLevel: env.LOG_LEVEL || "info",

    limits: {
      maxMessageBytes: int(env.MAX_MESSAGE_BYTES, 256 * 1024),
      maxShapesPerBoard: int(env.MAX_SHAPES_PER_BOARD, 5000),
      maxUsersPerBoard: int(env.MAX_USERS_PER_BOARD, 50),
      boardTtlDays: int(env.BOARD_TTL_DAYS, 30),
      // Board creation per IP per window.
      createBoardMax: int(env.CREATE_BOARD_MAX, 20),
      createBoardWindowMs: int(env.CREATE_BOARD_WINDOW_MS, 10 * 60 * 1000),
      // Socket events per connection: bucket size and refill per second.
      socketBurst: int(env.SOCKET_EVENT_BURST, 200),
      socketRatePerSec: int(env.SOCKET_EVENTS_PER_SEC, 60),
    },

    // How long to wait after the last change before writing a board to the
    // store, and how often to purge expired boards.
    saveDebounceMs: int(env.SAVE_DEBOUNCE_MS, 2000),
    cleanupIntervalMs: int(env.CLEANUP_INTERVAL_MS, 60 * 60 * 1000),
  };
}
