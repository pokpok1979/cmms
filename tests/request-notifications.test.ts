import test from "node:test";
import assert from "node:assert/strict";
import { notifyRequestCreated } from "../src/lib/request-notifications";
import { defaultPermissions } from "../src/lib/permissions";
import type { Row } from "../src/lib/db";

test("new requests notify active scoped approvers with a direct request link in the creation transaction", async () => {
  const session = {} as Parameters<typeof notifyRequestCreated>[1];
  const request = { _id: "rr", number: "RR-2026-000001", companyId: "a", siteId: "1" };
  const base = { role: "supervisor", grants: [{ companyId: "a", siteId: "1" }] };
  const noApproval = defaultPermissions("supervisor");
  noApproval.repairRequests.approve = false;
  const noView = defaultPermissions("supervisor");
  noView.repairRequests.view = false;
  const people = [
    { ...base, _id: "supervisor" }, { ...base, _id: "admin", role: "admin" },
    { ...base, _id: "denied", permissions: noApproval },
    { ...base, _id: "hidden", permissions: noView },
    { ...base, _id: "cross-pair", grants: [{ companyId: "a", siteId: "2" }, { companyId: "b", siteId: "1" }] },
    { ...base, _id: "technician", role: "technician" },
    { ...base, _id: "requester", role: "requester" },
    { ...base, _id: "executive", role: "executive" },
  ];
  const notices: Row[] = [];
  const d = { collection(name: string) { return {
    find(filter: unknown, options: unknown) {
      assert.equal(name, "users");
      assert.deepEqual(filter, { active: true, role: { $in: ["supervisor", "admin"] }, grants: { $elemMatch: { companyId: "a", siteId: "1" } } });
      assert.deepEqual(options, { session });
      return { async toArray() { return people; } };
    },
    async insertOne(row: Row, options: unknown) {
      assert.equal(name, "notifications");
      assert.deepEqual(options, { session });
      notices.push(row);
    },
  }; } } as unknown as Parameters<typeof notifyRequestCreated>[0];
  await notifyRequestCreated(d, session, request);
  assert.deepEqual(notices.map(row => row.recipientId), ["supervisor", "admin"]);
  for (const row of notices) {
    assert.equal(row.entityId, "rr");
    assert.equal(row.module, "repairRequests");
    assert.equal(row.companyId, "a");
    assert.equal(row.siteId, "1");
    assert.equal(row.read, false);
    assert.equal(row.message, "คำขอ RR-2026-000001: รออนุมัติ");
  }
});
