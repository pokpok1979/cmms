import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { connection, db, tx } from "../src/lib/db";
import { databaseContext } from "../src/lib/db-context";

test("overlapping Worker requests isolate clients while sharing within a request", async () => {
  const previousUri = process.env.MONGODB_URI;
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
  const clients: MongoClient[] = [];
  try {
    await Promise.all([0, 1].map(() => databaseContext.run({}, async () => {
      const client = connection();
      clients.push(client);
      assert.equal(client.options.serverMonitoringMode, "poll");
      assert.equal(client.options.maxPoolSize, 1);
      assert.equal(client.options.serverSelectionTimeoutMS, 5000);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(connection(), client);
    })));
    assert.notEqual(clients[0], clients[1]);
  } finally {
    await Promise.all(clients.map(client => client.close()));
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
  }
});

test("database requests wait for connection and recover after a failed connection", async (t) => {
  const previousUri = process.env.MONGODB_URI;
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const failure = new Error("Connection failed");
  let attempts = 0;
  t.mock.method(MongoClient.prototype, "connect", async function (this: MongoClient) {
    attempts++;
    if (attempts === 1) {
      await gate;
      throw failure;
    }
    return this;
  });
  const close = t.mock.method(MongoClient.prototype, "close", async () => {});
  try {
    const original = connection();
    const requests = [db(), db()];
    assert.equal(attempts, 1);
    release();
    const results = await Promise.allSettled(requests);
    for (const result of results) {
      assert.equal(result.status, "rejected");
      if (result.status === "rejected") assert.equal(result.reason, failure);
    }
    assert.equal(close.mock.callCount(), 1);
    const database = await db();
    assert.notEqual(connection(), original);
    assert.equal(database.client, connection());
    assert.equal(attempts, 2);

    const transactionFailure = new Error("Transaction failed");
    let ended = false;
    t.mock.method(MongoClient.prototype, "startSession", function (this: MongoClient) {
      assert.equal(this, database.client);
      return {
        withTransaction: async () => { throw transactionFailure; },
        endSession: async () => { ended = true; },
      };
    });
    await assert.rejects(tx(async () => undefined), transactionFailure);
    assert.equal(ended, true);
  } finally {
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
  }
});
