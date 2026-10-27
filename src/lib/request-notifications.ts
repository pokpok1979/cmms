import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongodb";
import type { db, Row } from "./db";
import { manager, type User } from "./domain";
import { permitted } from "./permissions";
import { canReceiveNotification } from "./notification-policy";
import { displayDocumentNumber } from "./document-number";

export async function notifyRequestCreated(d: Awaited<ReturnType<typeof db>>, session: ClientSession, request: Row) {
  const target = { module: "repairRequests", entityId: request._id, companyId: request.companyId, siteId: request.siteId };
  const recipients = await d.collection<Row>("users").find({
    active: true,
    role: { $in: ["supervisor", "admin"] },
    grants: { $elemMatch: { companyId: request.companyId, siteId: request.siteId } },
  }, { session }).toArray();
  for (const recipient of recipients) {
    const user = recipient as User;
    if (!manager(user) || !canReceiveNotification(user, target) || !permitted(user, "repairRequests", "approve")) continue;
    await d.collection<Row>("notifications").insertOne({
      _id: randomUUID(), ...target, recipientId: user._id,
      actorId: request.requesterId, actorName: request.requesterName,
      message: `คำขอ ${displayDocumentNumber(request.number)}: รออนุมัติ`,
      at: new Date(), read: false,
    }, { session });
  }
}
