import test from "node:test";
import assert from "node:assert/strict";
import { auditPageNumbers } from "../src/lib/audit-pagination";

test("numbered pagination includes current page, boundaries, and gaps", () => {
  assert.deepEqual(auditPageNumbers(1, 1), [1]);
  assert.deepEqual(auditPageNumbers(2, 4), [1, 2, 3, 4]);
  assert.deepEqual(auditPageNumbers(3, 15), [1, 2, 3, 4, "ellipsis", 15]);
  for (let page = 1; page <= 23; page++) {
    const entries = auditPageNumbers(page, 23);
    const numbers = entries.filter((entry): entry is number => typeof entry === "number");
    assert.equal(numbers[0], 1);
    assert.equal(numbers.at(-1), 23);
    assert.ok(numbers.includes(page));
    assert.equal(new Set(numbers).size, numbers.length);
    assert.ok(numbers.every(number => number >= 1 && number <= 23));
    assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
  }
});
