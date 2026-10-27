import { test } from "node:test";
import assert from "node:assert/strict";
import { deliverNotificationEmails, notificationEmail } from "../src/lib/notification-email";
import type { db, Row } from "../src/lib/db";

test("notification mail uses a fixed subject and trusted application link", () => {
  const mail = notificationEmail("งานใหม่\nรายละเอียด", "https://cmms.example.com");
  assert.equal(mail.subject.includes("\n"), false);
  assert.match(mail.text, /งานใหม่\nรายละเอียด/);
  assert.match(mail.text, /https:\/\/cmms.example.com\/\?view=notifications/);
  assert.equal(mail.disableFileAccess, true);
});

for (const scenario of ["sent", "denied", "inactive", "invalid-email", "smtp-failed"] as const) {
  test(`notification delivery: ${scenario}`, async () => {
    const notice = { _id: "notice", companyId: "company", recipientId: "person", emailAttempts: 1 };
    const updates: any[] = [];
    let claimed = false, sends = 0, closed = false;
    const database = { collection(name: string) { return {
      async findOneAndUpdate(filter: any, update: any) {
        if (name === "workerState") return { startedAt: new Date() };
        assert.deepEqual(filter.emailStatus, { $nin: ["sent", "skipped"] });
        assert.equal(filter.$and.length, 2);
        assert.ok(update.$set.emailLeaseUntil instanceof Date);
        if (claimed) return null;
        claimed = true;
        return { ...notice, emailToken: update.$set.emailToken };
      },
      async findOne() {
        if (name === "rolePermissions") return null;
        return scenario === "inactive" ? null : { _id: "person", role: "supervisor", email: scenario === "invalid-email" ? "bad" : "person@example.com", grants: [] };
      },
      async updateOne(filter: any, update: any) {
        assert.equal(filter._id, "notice");
        assert.equal(typeof filter.emailToken, "string");
        updates.push(update);
      },
    }; } } as unknown as Awaited<ReturnType<typeof db>>;
    const services = {
      settings: async () => ({ from: { name: "CMMS", address: "cmms@example.com" }, appUrl: "https://cmms.example.com" }),
      visible: async () => scenario === "denied" ? [] : [{ _id: "notice", message: "งานใหม่" } as Row],
      transport: () => ({
        async sendMail(mail: any) {
          sends++;
          assert.equal(mail.to, "person@example.com");
          if (scenario === "smtp-failed") throw Error("SMTP unavailable");
        },
        close() { closed = true; },
      }),
    } as unknown as NonNullable<Parameters<typeof deliverNotificationEmails>[2]>;
    const result = await deliverNotificationEmails(database, 2, services);
    const skipped = ["denied", "inactive", "invalid-email"].includes(scenario);
    assert.equal(sends, skipped ? 0 : 1);
    assert.equal(result.sent, scenario === "sent" ? 1 : 0);
    assert.equal(result.skipped, skipped ? 1 : 0);
    assert.equal(result.failed, scenario === "smtp-failed" ? 1 : 0);
    assert.equal(updates[0].$set.emailStatus, skipped ? "skipped" : scenario === "smtp-failed" ? "retry" : "sent");
    if (scenario === "smtp-failed") assert.ok(updates[0].$set.emailRetryAt > new Date());
    if (!skipped) assert.equal(closed, true);
  });
}
