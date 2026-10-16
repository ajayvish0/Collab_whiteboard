import { afterEach, describe, expect, it } from "vitest";
import { connected, emit, pencil, startServer } from "./helpers.js";

let ctx;
afterEach(async () => {
  await ctx?.close();
});

async function joined(env) {
  ctx = await startServer({ env });
  const boardId = await ctx.createBoard();
  const s = ctx.connect();
  await connected(s);
  await emit(s, "board:join", { boardId });
  return { s, boardId };
}

describe("payload validation", () => {
  const bad = {
    "unknown shape type": { ...pencil(), type: "<script>" },
    "bad color": { ...pencil(), style: { stroke: "red;", strokeWidth: 2 } },
    "huge stroke width": { ...pencil(), style: { stroke: "#000000", strokeWidth: 1e9 } },
    "too many points": { ...pencil(), points: Array.from({ length: 5001 }, () => [0, 0]) },
    "non-numeric point": { ...pencil(), points: [["a", 1]] },
    "infinite coordinate": { ...pencil(), points: [[1e12, 0]] },
    "bad id": { ...pencil(), id: "../../etc" },
    "text too long": {
      id: "t1",
      type: "text",
      x: 0,
      y: 0,
      text: "x".repeat(1001),
      fontSize: 16,
      style: { stroke: "#000000", strokeWidth: 2 },
    },
    "text without fontSize": {
      id: "t2",
      type: "text",
      x: 0,
      y: 0,
      text: "hi",
      style: { stroke: "#000000", strokeWidth: 2 },
    },
  };

  for (const [name, shape] of Object.entries(bad)) {
    it(`rejects ${name} and stores nothing`, async () => {
      const { s, boardId } = await joined();
      const res = await emit(s, "shape:add", { shapes: [shape] });
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/^invalid_payload/);
      expect((await emit(s, "board:join", { boardId })).shapes).toEqual([]);
    });
  }

  it("rejects a non-UUID board id", async () => {
    ctx = await startServer();
    const s = ctx.connect();
    await connected(s);
    const res = await emit(s, "board:join", { boardId: "abc" });
    expect(res.ok).toBe(false);
  });

  it("strips unknown fields before storing", async () => {
    const { s, boardId } = await joined();
    await emit(s, "shape:add", { shapes: [{ ...pencil(), evil: "x".repeat(1000) }] });
    const [stored] = (await emit(s, "board:join", { boardId })).shapes;
    expect(stored).not.toHaveProperty("evil");
  });

  // Audit probe [3]: a 500 KB junk object used to be stored and replayed.
  it("drops messages larger than the configured limit", async () => {
    const { s } = await joined({ MAX_MESSAGE_BYTES: "10000" });
    const big = pencil({ points: Array.from({ length: 4000 }, (_, i) => [i, i]) });
    await expect(emit(s, "shape:add", { shapes: [big] })).rejects.toThrow();
  });
});

describe("limits", () => {
  it("caps shapes per board", async () => {
    const { s } = await joined({ MAX_SHAPES_PER_BOARD: "2" });
    const res = await emit(s, "shape:add", { shapes: [pencil(), pencil(), pencil()] });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("shape_limit_reached");
    expect(res.added).toHaveLength(2);
  });

  it("caps participants per board", async () => {
    const { boardId } = await joined({ MAX_USERS_PER_BOARD: "1" });
    const other = ctx.connect();
    await connected(other);
    expect(await emit(other, "board:join", { boardId })).toEqual({
      ok: false,
      error: "board_full",
    });
  });

  it("rate-limits socket events", async () => {
    const { s } = await joined({ SOCKET_EVENT_BURST: "5", SOCKET_EVENTS_PER_SEC: "1" });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => emit(s, "cursor:move", { x: 1, y: 1 }))
    );
    expect(results.filter((r) => r.error === "rate_limited").length).toBeGreaterThanOrEqual(4);
  });

  it("rate-limits board creation per IP", async () => {
    ctx = await startServer({ env: { CREATE_BOARD_MAX: "2" } });
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await fetch(`${ctx.url}/boards`, { method: "POST" })).status);
    }
    expect(statuses).toEqual([201, 201, 429]);
  });
});

describe("origin checks", () => {
  it("refuses WebSocket handshakes from origins that are not allowed", async () => {
    ctx = await startServer({ env: { CORS_ORIGINS: "https://good.example" } });
    const s = ctx.connect({
      extraHeaders: { origin: "https://evil.example" },
      transports: ["polling"],
      reconnection: false,
    });
    const err = await new Promise((resolve) => s.once("connect_error", resolve));
    expect(err).toBeTruthy();
  });

  it("does not send CORS headers to other origins", async () => {
    ctx = await startServer({ env: { CORS_ORIGINS: "https://good.example" } });
    const res = await fetch(`${ctx.url}/healthz`, { headers: { origin: "https://evil.example" } });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff"); // helmet
  });
});
