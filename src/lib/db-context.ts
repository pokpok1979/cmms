import { AsyncLocalStorage } from "node:async_hooks";
import type { MongoClient } from "mongodb";

export interface DatabaseState {
  client?: MongoClient;
  connecting?: Promise<MongoClient>;
}

// The Worker entry and the Next.js bundle must share the same context instance.
const key = Symbol.for("cmms.database.request-context");
const shared = globalThis as typeof globalThis & {
  [key]?: AsyncLocalStorage<DatabaseState>;
};
export const databaseContext = shared[key] ??= new AsyncLocalStorage<DatabaseState>();
