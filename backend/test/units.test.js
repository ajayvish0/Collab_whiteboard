import { describe, expect, it } from "vitest";
import { createTokenBucket } from "../src/rateLimiter.js";
import { loadConfig } from "../src/config.js";
import { liveStrokeSchema, shapeSchema, validate } from "../src/schemas.js";

describe("token bucket", () => {
  it("allows a burst, then refills over time", () => {
    let t = 0;
    const bucket = createTokenBucket({ capacity: 3, ratePerSec: 2, now: () => t });
    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([
      true, true, true, false,
    ]);
    t = 500; // +1 token
    expect(bucket.take()).toBe(true);
    expect(bucket.take()).toBe(false);
  });
});

describe("config", () => {
  it("parses CORS origins and strips trailing slashes", () => {
    const c = loadConfig({ CORS_ORIGINS: "https://a.example/, http://localhost:5173", PORT: "4000" });
    expect(c.corsOrigins).toEqual(["https://a.example", "http://localhost:5173"]);
    expect(c.port).toBe(4000);
    expect(c.databaseUrl).toBeNull();
  });

  it("defaults to the production frontend and Render's proxy", () => {
    const c = loadConfig({ RENDER: "true" });
    expect(c.corsOrigins).toEqual(["http://localhost:5173", "https://collaoboard.netlify.app"]);
    expect(c.trustProxy).toBe(1);
    expect(loadConfig({}).trustProxy).toBe(0);
  });
});

describe("schemas", () => {
  const style = { stroke: "#00ff00", strokeWidth: 4 };

  it("accepts each shape type", () => {
    for (const shape of [
      { id: "p", type: "pencil", style, points: [[0, 0]] },
      { id: "r", type: "rect", style, x: 1, y: 2, w: 3, h: 4 },
      { id: "e", type: "ellipse", style, x: 1, y: 2, w: 3, h: 4 },
      { id: "t", type: "text", style, x: 1, y: 2, text: "hi\nthere", fontSize: 20 },
    ]) {
      expect(validate(shapeSchema, shape)).toMatchObject({ ok: true });
    }
  });

  it("rejects negative rectangle sizes", () => {
    const r = validate(shapeSchema, { id: "r", type: "rect", style, x: 0, y: 0, w: -1, h: 1 });
    expect(r.ok).toBe(false);
  });

  it("accepts live pencil chunks and live rectangles", () => {
    expect(
      validate(liveStrokeSchema, { id: "a", type: "pencil", style, points: [], append: true }).ok
    ).toBe(true);
    expect(
      validate(liveStrokeSchema, { id: "a", type: "rect", style, x: 0, y: 0, w: 1, h: 1 }).ok
    ).toBe(true);
  });
});
