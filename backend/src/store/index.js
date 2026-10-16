import { createMemoryStore } from "./memoryStore.js";
import { createPostgresStore } from "./postgresStore.js";

export function createStore(config) {
  return config.databaseUrl
    ? createPostgresStore({ connectionString: config.databaseUrl })
    : createMemoryStore();
}

export { createMemoryStore, createPostgresStore };
