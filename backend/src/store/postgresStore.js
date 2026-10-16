import pg from "pg";

// Durable store. One row per board; the shape list is a JSONB snapshot that
// the board manager rewrites (debounced) after changes.
//
// `pool` can be injected (tests use pg-mem); otherwise one is created from
// `connectionString`.
export function createPostgresStore({ connectionString, pool } = {}) {
  const db =
    pool ??
    new pg.Pool({
      connectionString,
      max: 5,
      // Managed Postgres providers (Render, Neon, Supabase) require TLS.
      ssl: /localhost|127\.0\.0\.1/.test(connectionString ?? "")
        ? false
        : { rejectUnauthorized: false },
    });

  const toBoard = (row) =>
    row && {
      shapes: row.shapes,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };

  return {
    kind: "postgres",

    async init() {
      await db.query(`
        CREATE TABLE IF NOT EXISTS boards (
          id         UUID PRIMARY KEY,
          shapes     JSONB  NOT NULL DEFAULT '[]'::jsonb,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        )`);
      await db.query(
        "CREATE INDEX IF NOT EXISTS boards_updated_at_idx ON boards (updated_at)"
      );
    },

    async create(id, now = Date.now()) {
      await db.query(
        "INSERT INTO boards (id, shapes, created_at, updated_at) VALUES ($1, '[]'::jsonb, $2, $2)",
        [id, now]
      );
    },

    async load(id) {
      const { rows } = await db.query(
        "SELECT shapes, created_at, updated_at FROM boards WHERE id = $1",
        [id]
      );
      return toBoard(rows[0]) ?? null;
    },

    async save(id, shapes, now = Date.now()) {
      const { rowCount } = await db.query(
        "UPDATE boards SET shapes = $2::jsonb, updated_at = $3 WHERE id = $1",
        [id, JSON.stringify(shapes), now]
      );
      return rowCount > 0;
    },

    async deleteOlderThan(cutoff) {
      const { rowCount } = await db.query(
        "DELETE FROM boards WHERE updated_at < $1",
        [cutoff]
      );
      return rowCount;
    },

    async close() {
      await db.end();
    },
  };
}
