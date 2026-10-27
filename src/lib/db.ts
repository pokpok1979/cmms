import { MongoClient, Document } from "mongodb";
import { databaseContext, type DatabaseState } from "./db-context";

const nodeState: DatabaseState = {};
const state = () => databaseContext.getStore() ?? nodeState;
export function connection() {
  if (!process.env.MONGODB_URI) throw new Error("Database not configured");
  return (state().client ??= new MongoClient(process.env.MONGODB_URI));
}
export async function db() {
  const c = await connectedClient();
  return c.db(process.env.MONGODB_DB || "cmms");
}
async function connectedClient() {
  const current = state();
  if (!current.connecting) {
    const c = connection();
    // Share connection establishment so concurrent requests never use a
    // topology that another request is still opening (or closing on failure).
    current.connecting = c.connect().catch(async (error) => {
      try {
        await c.close();
      } catch {
        // Preserve the original connection error.
      }
      if (current.client === c) current.client = undefined;
      throw error;
    }).finally(() => {
      current.connecting = undefined;
    });
  }
  return current.connecting;
}
export async function tx<T>(
  fn: (
    d: Awaited<ReturnType<typeof db>>,
    s: import("mongodb").ClientSession,
  ) => Promise<T>,
) {
  const c = await connectedClient();
  const s = c.startSession();
  try {
    return (await s.withTransaction(() =>
      fn(c.db(process.env.MONGODB_DB || "cmms"), s),
    )) as T;
  } finally {
    await s.endSession();
  }
}
export type Row = Document & { _id: string };
export async function number(
  d: Awaited<ReturnType<typeof db>>,
  s: import("mongodb").ClientSession,
  site: string,
  kind: string,
) {
  const year = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(new Date());
  const sharedSequence = kind === "RR" || kind === "WO";
  const key = sharedSequence ? `${kind}:${year}` : `${site}:${kind}:${year}`;
  if (sharedSequence && !await d.collection<Row>("documentSequences").findOne({ _id: key }, { session: s })) {
    // Continue above all existing site sequences when switching to a shared document sequence.
    const existing = await d.collection<Row>("documentSequences").find({
      _id: { $regex: `:${kind}:${year}$` },
    }, { session: s }).sort({ value: -1 }).limit(1).next();
    await d.collection<Row>("documentSequences").updateOne(
      { _id: key },
      { $setOnInsert: { value: existing?.value || 0 } },
      { upsert: true, session: s },
    );
  }
  const r = await d
    .collection<Row>("documentSequences")
    .findOneAndUpdate(
      { _id: key },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after", session: s },
    );
  return `${kind}-${sharedSequence ? "" : `${site}-`}${year}-${String(r!.value).padStart(6, "0")}`;
}
