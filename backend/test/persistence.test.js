import { afterEach, describe, expect, it } from "vitest";
import { newDb } from "pg-mem";
import { connected, emit, pencil, sleep, startServer } from "./helpers.js";
import { createMemoryStore } from "../src/store/memoryStore.js";
import { createPostgresStore } from "../src/store/postgresStore.js";

let ctx;
afterEach(async () => {
  await ctx?.close();
  ctx = null;
});

function pgMemStore() {
  const { Pool } = newDb().adapters.createPg();
  const pool = new Pool();
  // Keep the in-memory database alive across server restarts in a test.
  // pg-mem cannot re-run CREATE TABLE IF NOT EXISTS on an existing table
  // (real Postgres can), so the schema is only created once per database.
  let initialized;
  return {
    pool,
    make: () => {
      const store = createPostgresStore({ pool });
      return {
        ...store,
        init: () => (initialized ??= store.init()),
        close: async () => {},
      };
    },
  };
}

const storeFactories = {
  memory: () => {
    const store = createMemoryStore();
    return () => ({ ...store, close: async () => {} });
  },
  postgres: () => pgMemStore().make,
};

describe.each(Object.keys(storeFactories))("%s store", (kind) => {
  // Audit probe [2]: boards used to vanish on restart.
  it("keeps boards across a server restart", async () => {
    const makeStore = storeFactories[kind]();

    ctx = await startServer({ store: makeStore() });
    const boardId = await ctx.createBoard();
    const a = ctx.connect();
    await connected(a);
    await emit(a, "board:join", { boardId });
    await emit(a, "shape:add", { shapes: [pencil(), pencil()] });
    await ctx.close(); // flushes pending writes

    ctx = await startServer({ store: makeStore() });
    const b = ctx.connect();
    await connected(b);
    const res = await emit(b, "board:join", { boardId });
    expect(res.ok).toBe(true);
    expect(res.shapes).toHaveLength(2);
  });

  it("writes changes after the debounce while people are still connected", async () => {
    const store = storeFactories[kind]()();
    ctx = await startServer({ store });
    const boardId = await ctx.createBoard();
    const a = ctx.connect();
    await connected(a);
    await emit(a, "board:join", { boardId });
    await emit(a, "shape:add", { shapes: [pencil()] });
    await sleep(100); // debounce is 20 ms in tests
    expect((await store.load(boardId)).shapes).toHaveLength(1);
  });

  it("purges boards that were not updated within the TTL", async () => {
    const store = storeFactories[kind]()();
    await store.init();
    await store.create("11111111-1111-4111-8111-111111111111", 1000);
    await store.create("22222222-2222-4222-8222-222222222222", 5000);
    expect(await store.deleteOlderThan(3000)).toBe(1);
    expect(await store.load("11111111-1111-4111-8111-111111111111")).toBeNull();
    expect(await store.load("22222222-2222-4222-8222-222222222222")).not.toBeNull();
  });
});

describe("memory store", () => {
  it("evicts the least recently updated board when full", async () => {
    const store = createMemoryStore({ maxBoards: 2 });
    await store.create("a");
    await store.create("b");
    await store.save("a", []);
    await store.create("c");
    expect(await store.load("b")).toBeNull();
    expect(await store.load("a")).not.toBeNull();
  });
});
