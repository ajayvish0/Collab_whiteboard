import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createStore } from "./store/index.js";

const config = loadConfig();
const logger = createLogger(config.logLevel);
const store = createStore(config);
const server = createApp({ config, store, logger });

const port = await server.start(config.port);
logger.info("server listening", {
  port,
  store: store.kind,
  corsOrigins: config.corsOrigins,
});
if (store.kind === "memory") {
  logger.warn("DATABASE_URL is not set: boards are kept in memory and lost on restart");
}

// Render and Docker send SIGTERM on deploys; flush pending board writes first.
let shuttingDown = false;
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("shutting down", { signal });
    try {
      await server.close();
      process.exit(0);
    } catch (err) {
      logger.error("shutdown failed", { err: err.message });
      process.exit(1);
    }
  });
}
