import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "../src/lib/domain";
import { modules, defaultPermissions } from "../src/lib/permissions";
import { canReceiveNotification, type NotificationTarget } from "../src/lib/notification-policy";
import { visibleNotifications } from "../src/lib/notification-inbox";

const actor: User = { _id: "actor", username: "admin", name: "ผู้สร้าง", role: "admin", grants: [{ companyId: "a", siteId: "1" }] };
const target: NotificationTarget = { module: "repairRequests", entityId: "rr", companyId: "a", siteId: "1", requesterId: "requester" };
test("single read filters by notification ID and repeated notices resolve each record once per request", async () => {
  let lookups = 0;
  let requesterId = "requester";
  const d = { collection(name: string) { return {
    find(filter: any) {
      assert.equal(filter._id, "notice");
      assert.equal(filter.recipientId, "requester");
      return { sort() { return { async toArray() {
        return [1, 2, 3].map(i => ({ _id: `notice-${i}`, module: "workOrders", entityId: "wo", companyId: "a", siteId: "1", message: "updated" }));
      } }; } };
    },
    async findOne(filter: any) {
      lookups++;
      assert.deepEqual(filter.$or, actor.grants);
      return name === "workOrders"
        ? { _id: "wo", companyId: "a", siteId: "1", requestId: "rr" }
        : { _id: "rr", companyId: "a", siteId: "1", requesterId };
    },
  }; } } as unknown as Parameters<typeof visibleNotifications>[0];
  assert.equal((await visibleNotifications(d, person("requester"), "notice")).length, 3);
  assert.equal(lookups, 2);
  requesterId = "someone-else";
  assert.deepEqual(await visibleNotifications(d, person("requester"), "notice"), []);
  assert.equal(lookups, 4);
});
function person(role: User["role"], id: string = role): User { return { ...actor, _id: id, role }; }

test("all registered modules support notifications and enforce saved permissions and exact company/site pairs", () => {
  for (const [module] of modules) {
    assert.equal(canReceiveNotification(actor, { ...target, module }), true, module);
    const permissions = defaultPermissions("admin");
    permissions[module].view = false;
    assert.equal(canReceiveNotification({ ...actor, permissions }, { ...target, module }), false, module);
    assert.equal(canReceiveNotification(actor, { ...target, module, siteId: "2" }), false, module);
    assert.equal(canReceiveNotification(actor, { ...target, module, companyId: "b" }), false, module);
  }
});

test("inbox rechecks current ownership and assignment, and resolves legacy notifications", async () => {
  const legacyNumber = "RR-096dec8c-ac18-44cb-af6b-b852fc6f69f4-2026-000001";
  const rows = [
    { _id: "old", companyId: "a", siteId: "1", message: `${legacyNumber} เปลี่ยนสถานะเป็น approved`, read: false },
    { _id: "revoked", companyId: "a", siteId: "1", module: "workOrders", entityId: "wo", message: "assigned", read: false },
    { _id: "admin-only", companyId: "a", siteId: "1", module: "users", entityId: "user", message: "new user", read: false },
  ];
  const d = { collection(name: string) {
    return {
      find(filter: any) {
        assert.equal(name, "notifications");
        assert.equal(filter.recipientId, "requester");
        assert.deepEqual(filter.$or, actor.grants);
        return { sort() { return { async toArray() { return rows; } }; } };
      },
      async findOne(filter: any) {
        assert.deepEqual(filter.$or, actor.grants);
        if (name === "repairRequests" && filter.number === legacyNumber)
          return { _id: "rr", ...target };
        if (name === "workOrders" && filter._id === "wo")
          return { _id: "wo", companyId: "a", siteId: "1", requestId: "someone-else" };
        return null;
      },
    };
  } } as unknown as Parameters<typeof visibleNotifications>[0];
  const items = await visibleNotifications(d, person("requester"));
  assert.equal(items.length, 1);
  assert.equal(items[0]._id, "old");
  assert.equal(items[0].entityId, "rr");
  assert.equal(items[0].module, "repairRequests");
  assert.equal(items[0].message, "RR-2026-000001 เปลี่ยนสถานะเป็น อนุมัติแล้ว");
});

test("technician inbox hides jobs after reassignment", async () => {
  const d = { collection(name: string) {
    return {
      find() { return { sort() { return { async toArray() { return [{ _id: "notice", companyId: "a", siteId: "1", module: "workOrders", entityId: "wo", message: "assigned" }]; } }; } }; },
      async findOne() { return name === "workOrders" ? { _id: "wo", companyId: "a", siteId: "1", assigneeIds: ["another-technician"] } : null; },
    };
  } } as unknown as Parameters<typeof visibleNotifications>[0];
  assert.deepEqual(await visibleNotifications(d, person("technician")), []);
});

test("requesters only receive their own jobs and technicians only receive assigned jobs", () => {
  for (const module of ["repairRequests", "workOrders"]) {
    assert.equal(canReceiveNotification(person("requester"), { ...target, module }), true);
    assert.equal(canReceiveNotification(person("requester", "another"), { ...target, module }), false);
    assert.equal(canReceiveNotification(person("technician"), { ...target, module }), false);
    assert.equal(canReceiveNotification(person("technician"), { ...target, module, assigneeIds: ["technician"] }), true);
    assert.equal(canReceiveNotification(person("supervisor"), { ...target, module }), true);
  }
  assert.equal(canReceiveNotification(person("supervisor"), { ...target, module: "users" }), false);
  assert.equal(canReceiveNotification(person("supervisor"), { ...target, module: "roles" }), false);
});

