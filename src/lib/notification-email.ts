import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, type Row } from "./db";
import type { User } from "./domain";
import { resolvePermissions } from "./permissions";
import { visibleNotifications } from "./notification-inbox";
import { recoveryMailSettings, smtpTransport } from "./password-recovery-mail";

export function notificationEmail(message: string, appUrl: string) {
  const url = new URL(appUrl);
  url.searchParams.set("view", "notifications");
  return {
    subject: "AGE CMMS — แจ้งเตือนงาน",
    text: `${message}\n\nเปิดการแจ้งเตือนในระบบ:\n${url.toString()}`,
    disableFileAccess: true, disableUrlAccess: true,
  };
}

// Run outside request transactions: an SMTP outage must never roll back work.
export async function deliverNotificationEmails(database?: Awaited<ReturnType<typeof db>>, limit = 50,
  services = { settings: recoveryMailSettings, transport: smtpTransport, visible: visibleNotifications }) {
  const d = database ?? await db();
  const now = new Date();
  const state = await d.collection<Row>("workerState").findOneAndUpdate(
    { _id: "notification-email" }, { $setOnInsert: { startedAt: now } },
    { upsert: true, returnDocument: "after" },
  );
  const result = { sent: 0, skipped: 0, failed: 0 };
  for (let i = 0; i < limit; i++) {
    const token = randomUUID();
    const notice = await d.collection<Row>("notifications").findOneAndUpdate({
      at: { $gte: state!.startedAt },
      emailStatus: { $nin: ["sent", "skipped"] },
      $and: [
        { $or: [{ emailRetryAt: { $exists: false } }, { emailRetryAt: { $lte: new Date() } }] },
        { $or: [{ emailLeaseUntil: { $exists: false } }, { emailLeaseUntil: { $lte: new Date() } }] },
      ],
    }, { $set: { emailToken: token, emailLeaseUntil: new Date(Date.now() + 300000) }, $inc: { emailAttempts: 1 } },
    { sort: { at: 1, _id: 1 }, returnDocument: "after" });
    if (!notice) break;
    const filter = { _id: notice._id, emailToken: token };
    try {
      const recipient = await d.collection<Row>("users").findOne({ _id: notice.recipientId, active: true });
      const policy = recipient && await d.collection<Row>("rolePermissions").findOne({ _id: recipient.role });
      const actor = recipient && { ...recipient, permissions: resolvePermissions(recipient.role, policy?.matrix) } as User;
      const visible = actor && await services.visible(d, actor, notice._id);
      if (!recipient || !z.email().safeParse(recipient.email).success || !visible?.length) {
        await d.collection<Row>("notifications").updateOne(filter, { $set: { emailStatus: "skipped", emailFinishedAt: new Date() }, $unset: { emailToken: "", emailLeaseUntil: "" } });
        result.skipped++;
        continue;
      }
      const settings = await services.settings(notice.companyId);
      const transport = services.transport(settings);
      try {
        await transport.sendMail({ from: settings.from, to: recipient.email,
          messageId: `<${Buffer.from(notice._id).toString("hex")}@cmms.notifications>`,
          ...notificationEmail(visible[0].message, settings.appUrl),
        });
      } finally { transport.close(); }
      await d.collection<Row>("notifications").updateOne(filter, { $set: { emailStatus: "sent", emailFinishedAt: new Date() }, $unset: { emailToken: "", emailLeaseUntil: "", emailRetryAt: "" } });
      result.sent++;
    } catch {
      const delay = Math.min(3600000, 60000 * 2 ** Math.min(notice.emailAttempts - 1, 6));
      await d.collection<Row>("notifications").updateOne(filter, { $set: { emailStatus: "retry", emailRetryAt: new Date(Date.now() + delay) }, $unset: { emailToken: "", emailLeaseUntil: "" } });
      result.failed++;
    }
  }
  return result;
}
