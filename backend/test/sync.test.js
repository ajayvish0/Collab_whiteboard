import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connected, emit, pencil, record, sleep, startServer, waitFor } from "./helpers.js";

let ctx;
beforeEach(async () => {
  ctx = await startServer();
});
afterEach(async () => {
  await ctx.close();
});

async function joinedPair() {
  const boardId = await ctx.createBoard();
  const a = ctx.connect();
  const b = ctx.connect();
  await Promise.all([connected(a), connected(b)]);
  await emit(a, "board:join", { boardId, name: "Alice" });
  await emit(b, "board:join", { boardId, name: "Bob" });
  return { boardId, a, b };
}

describe("HTTP", () => {
  it("serves a health check", async () => {
    const res = await fetch(`${ctx.url}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", store: "memory" });
  });

  it("creates boards with UUID ids", async () => {
    const res = await fetch(`${ctx.url}/boards`, { method: "POST" });
    expect(res.status).toBe(201);
    const { boardId } = await res.json();
    expect(boardId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("real-time sync", () => {
  // Audit probe [1]: the sender used to receive its own stroke back.
  it("does not echo shapes back to the sender", async () => {
    const { a, b } = await joinedPair();
    const aSeen = record(a, "shape:add");
    const bGot = waitFor(b, "shape:add");

    const res = await emit(a, "shape:add", { shapes: [pencil()] });
    expect(res).toEqual({ ok: true });
    expect((await bGot).shapes).toHaveLength(1);
    await sleep(50);
    expect(aSeen).toHaveLength(0);
  });

  it("ignores a shape id that already exists (idempotent add)", async () => {
    const { a, b } = await joinedPair();
    const bSeen = record(b, "shape:add");
    const shape = pencil();
    await emit(a, "shape:add", { shapes: [shape] });
    await emit(a, "shape:add", { shapes: [shape] });
    await sleep(50);
    expect(bSeen).toHaveLength(1);
  });

  it("sends the full board and participant list to a late joiner", async () => {
    const { boardId, a } = await joinedPair();
    await emit(a, "shape:add", { shapes: [pencil(), pencil()] });

    const c = ctx.connect();
    await connected(c);
    const res = await emit(c, "board:join", { boardId, name: "Carol" });
    expect(res.ok).toBe(true);
    expect(res.shapes).toHaveLength(2);
    expect(res.shapes[0]).toHaveProperty("authorId");
    expect(res.users.map((u) => u.name).sort()).toEqual(["Alice", "Bob", "Carol"]);
    expect(res.self.name).toBe("Carol");
  });

  it("deletes shapes for everyone and reports what was deleted", async () => {
    const { a, b } = await joinedPair();
    const s1 = pencil();
    const s2 = pencil();
    await emit(a, "shape:add", { shapes: [s1, s2] });

    const bSeen = record(b, "shape:delete");
    const aGot = waitFor(a, "shape:delete");
    const res = await emit(b, "shape:delete", { ids: [s1.id, "missing"] });
    expect(res).toEqual({ ok: true, deleted: [s1.id] });
    expect(await aGot).toEqual({ ids: [s1.id] });
    await sleep(30);
    expect(bSeen).toHaveLength(0);
  });

  it("clears the board for everyone", async () => {
    const { boardId, a, b } = await joinedPair();
    await emit(a, "shape:add", { shapes: [pencil()] });
    const bGot = waitFor(b, "board:clear");
    await emit(a, "board:clear", {});
    expect(await bGot).toHaveProperty("by");

    const c = ctx.connect();
    await connected(c);
    const res = await emit(c, "board:join", { boardId });
    expect(res.shapes).toEqual([]);
  });

  it("relays live strokes, stroke end and cursors to peers only", async () => {
    const { a, b } = await joinedPair();
    const aSeen = record(a, "cursor:move");

    const live = waitFor(b, "stroke:live");
    a.emit("stroke:live", {
      id: "s1",
      type: "pencil",
      style: { stroke: "#ff0000", strokeWidth: 3 },
      points: [[1, 2]],
      append: false,
    });
    expect((await live).stroke).toMatchObject({ id: "s1", points: [[1, 2]] });

    const end = waitFor(b, "stroke:end");
    a.emit("stroke:end", { id: "s1" });
    expect((await end).id).toBe("s1");

    const cursor = waitFor(b, "cursor:move");
    a.emit("cursor:move", { x: 5, y: 6 });
    expect(await cursor).toEqual({ userId: a.id, x: 5, y: 6 });
    await sleep(30);
    expect(aSeen).toHaveLength(0);
  });

  it("announces joins and leaves", async () => {
    const { boardId, a } = await joinedPair();
    const c = ctx.connect();
    await connected(c);
    const joined = waitFor(a, "presence:join");
    await emit(c, "board:join", { boardId, name: "Carol" });
    expect((await joined).name).toBe("Carol");

    const left = waitFor(a, "presence:leave");
    c.disconnect();
    expect((await left).userId).toBeTruthy();
  });
});

describe("missing boards", () => {
  // Audit probe [2]: unknown boards used to fail silently.
  it("rejects joining an unknown board with not_found", async () => {
    const s = ctx.connect();
    await connected(s);
    const res = await emit(s, "board:join", { boardId: crypto.randomUUID() });
    expect(res).toEqual({ ok: false, error: "not_found" });
  });

  it("rejects drawing before joining", async () => {
    const s = ctx.connect();
    await connected(s);
    expect(await emit(s, "shape:add", { shapes: [pencil()] })).toEqual({
      ok: false,
      error: "not_joined",
    });
  });
});

describe("reconnects", () => {
  // Audit probe [4]: after a reconnect the client was no longer in the room.
  // The client now re-joins on every "connect"; this verifies that pattern.
  it("keeps receiving updates after the transport drops, when rejoining on connect", async () => {
    const boardId = await ctx.createBoard();
    const a = ctx.connect();
    const b = ctx.connect({ reconnectionDelay: 10, reconnectionDelayMax: 20 });
    let joins = 0;
    b.on("connect", () => {
      emit(b, "board:join", { boardId }).then(() => joins++);
    });
    await Promise.all([connected(a), connected(b)]);
    await emit(a, "board:join", { boardId });
    while (joins < 1) await sleep(5);

    b.io.engine.close(); // simulate a network drop
    while (joins < 2) await sleep(5);

    const got = waitFor(b, "shape:add");
    await emit(a, "shape:add", { shapes: [pencil()] });
    expect((await got).shapes).toHaveLength(1);
  });
});
