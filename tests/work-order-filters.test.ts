import test from "node:test";
import assert from "node:assert/strict";
import { workOrderStatusFilter, workOrderListFilter } from "../src/lib/work-order-filters";

test("outstanding work orders exclude completed and cancelled jobs", () => {
  const filter = workOrderStatusFilter("outstanding");
  assert.deepEqual(filter, { $nin: ["completed", "cancelled"] });
  if (typeof filter === "string" || !filter.$nin) throw Error("Expected exclusion filter");
  for (const status of ["unassigned", "assigned", "in_progress", "waiting_parts", "waiting_contractor", "review"])
    assert.equal(filter.$nin.includes(status), false);
});
test("individual status filters remain exact", () => {
  for (const status of ["completed", "cancelled", "review", "in_progress"])
    assert.equal(workOrderStatusFilter(status), status);
});

test("overdue requires a past deadline and excludes finished work", () => {
  const now = new Date("2026-10-23T05:00:00Z");
  assert.deepEqual(workOrderListFilter("overdue", now), {
    status: { $nin: ["completed", "cancelled"] },
    dueAt: { $lt: now },
  });
  assert.deepEqual(workOrderListFilter("outstanding", now), {
    status: { $nin: ["completed", "cancelled"] },
  });
  assert.deepEqual(workOrderListFilter("completed", now), { status: "completed" });
  assert.deepEqual(workOrderListFilter("", now), {});
});

test("waiting group includes only parts and contractor statuses", () => {
  assert.deepEqual(workOrderListFilter("waiting"), {
    status: { $in: ["waiting_parts", "waiting_contractor"] },
  });
  for (const status of ["waiting_parts", "waiting_contractor"])
    assert.equal(workOrderStatusFilter(status), status);
});
