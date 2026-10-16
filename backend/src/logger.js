// Minimal structured (JSON lines) logger. Render and most log collectors
// parse one JSON object per line.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export function createLogger(level = "info", sink = console) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const log = (lvl) => (msg, fields = {}) => {
    if (LEVELS[lvl] < threshold) return;
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level: lvl,
      msg,
      ...fields,
    });
    (lvl === "error" || lvl === "warn" ? sink.error : sink.log)(line);
  };

  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
  };
}
