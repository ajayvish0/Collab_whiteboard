import { z } from "zod";

// Every payload that arrives over the socket is untrusted. These schemas are
// the single source of truth for what the server accepts and stores.

export const LIMITS = {
  maxCoord: 1_000_000,
  maxSize: 100_000,
  maxPoints: 5000,
  maxLivePoints: 500,
  maxTextLength: 1000,
  maxDeleteBatch: 1000,
  maxNameLength: 32,
};

const coord = z.number().finite().min(-LIMITS.maxCoord).max(LIMITS.maxCoord);
const size = z.number().finite().min(0).max(LIMITS.maxSize);
const point = z.tuple([coord, coord]);

export const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const boardIdSchema = z.string().uuid();

const style = z.object({
  stroke: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  strokeWidth: z.number().finite().min(1).max(50),
});

const base = { id: idSchema, style };

const pencil = z.object({
  ...base,
  type: z.literal("pencil"),
  points: z.array(point).min(1).max(LIMITS.maxPoints),
});

const rect = z.object({
  ...base,
  type: z.literal("rect"),
  x: coord,
  y: coord,
  w: size,
  h: size,
});

const ellipse = rect.extend({ type: z.literal("ellipse") });

const text = z.object({
  ...base,
  type: z.literal("text"),
  x: coord,
  y: coord,
  text: z.string().min(1).max(LIMITS.maxTextLength),
  fontSize: z.number().finite().min(8).max(200),
});

// Strip unknown keys so clients cannot smuggle extra data into storage.
export const shapeSchema = z.discriminatedUnion("type", [
  pencil,
  rect,
  ellipse,
  text,
]);

export const joinSchema = z.object({
  boardId: boardIdSchema,
  name: z.string().trim().min(1).max(LIMITS.maxNameLength).optional(),
});

export const addShapesSchema = z.object({
  shapes: z.array(shapeSchema).min(1).max(100),
});

export const deleteShapesSchema = z.object({
  ids: z.array(idSchema).min(1).max(LIMITS.maxDeleteBatch),
});

// An in-progress stroke. Pencil strokes are streamed incrementally: `points`
// holds only the points added since the previous message.
export const liveStrokeSchema = z.union([
  z.object({
    id: idSchema,
    type: z.literal("pencil"),
    style,
    points: z.array(point).max(LIMITS.maxLivePoints),
    append: z.boolean(),
  }),
  rect,
  ellipse,
]);

export const liveEndSchema = z.object({ id: idSchema });

export const cursorSchema = z.object({ x: coord, y: coord });

/** Returns `{ ok: true, data }` or `{ ok: false, error }` with a short message. */
export function validate(schema, payload) {
  const result = schema.safeParse(payload);
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  const where = issue?.path?.length ? ` at ${issue.path.join(".")}` : "";
  return { ok: false, error: `invalid_payload: ${issue?.message ?? "invalid"}${where}` };
}

export const clearSchema = z.object({});
