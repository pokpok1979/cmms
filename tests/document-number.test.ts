import test from "node:test";
import assert from "node:assert/strict";
import { number } from "../src/lib/db";
import { displayDocumentNumber } from "../src/lib/document-number";

test("legacy document numbers hide the site UUID without changing other numbers", () => {
  assert.equal(displayDocumentNumber("RR-096dec8c-ac18-44cb-af6b-b852fc6f69f4-2026-000001"), "RR-2026-000001");
  assert.equal(displayDocumentNumber("WO-096dec8c-ac18-44cb-af6b-b852fc6f69f4-2026-000001"), "WO-2026-000001");
  assert.equal(displayDocumentNumber("RR-2026-000002"), "RR-2026-000002");
  assert.equal(displayDocumentNumber("WO-site-2026-000001"), "WO-site-2026-000001");
});

test("new repair numbers continue the highest legacy sequence and are shared across sites", async () => {
  const counters = new Map<string, number>();
  const collection = {
    async findOne({ _id }: { _id: string }) { return counters.has(_id) ? { value: counters.get(_id) } : null; },
    find() { return { sort() { return { limit() { return { async next() { return { value: 12 }; } }; } }; } }; },
    async updateOne({ _id }: { _id: string }, update: any) { if (!counters.has(_id)) counters.set(_id, update.$setOnInsert.value); },
    async findOneAndUpdate({ _id }: { _id: string }) {
      const value = (counters.get(_id) || 0) + 1;
      counters.set(_id, value);
      return { value };
    },
  };
  const database = { collection: () => collection } as unknown as Parameters<typeof number>[0];
  const session = {} as Parameters<typeof number>[1];
  const first = await number(database, session, "site-a", "RR");
  const second = await number(database, session, "site-b", "RR");
  assert.match(first, /^RR-\d{4}-000013$/);
  assert.match(second, /^RR-\d{4}-000014$/);
  assert.equal(counters.size, 1);
  assert.match(await number(database, session, "site-a", "WO"), /^WO-\d{4}-000013$/);
  assert.match(await number(database, session, "site-b", "WO"), /^WO-\d{4}-000014$/);
});
