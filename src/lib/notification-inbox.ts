import type { db, Row } from "./db";
import { labels, scope, type User } from "./domain";
import { canReceiveNotification } from "./notification-policy";
import { displayDocumentNumber } from "./document-number";

export async function visibleNotifications(d: Awaited<ReturnType<typeof db>>, actor: User, notificationId?: string) {
  const rows = await d.collection<Row>("notifications").find({ recipientId: actor._id, ...scope(actor), ...(notificationId ? { _id: notificationId } : {}) }).sort({ at: -1, _id: -1 }).toArray();
  // Cache only within this read, so every request still checks current access.
  const records = new Map<string, Promise<Row | null>>();
  async function findRecord(collection: string, lookup: Record<string, unknown>) {
    const key = JSON.stringify([collection, lookup]);
    if (!records.has(key)) records.set(key, d.collection<Row>(collection).findOne({ ...lookup, ...scope(actor) }));
    const record = await records.get(key)!;
    return record ? { ...record } : null;
  }
  const visible: Row[] = [];
  for (const row of rows) {
    let module = row.module;
    let record: Row | null = null;
    // Older notifications stored only a message, not a link to the record.
    const legacyNumber = !row.entityId && typeof row.message === "string"
      ? row.message.match(/^(?:ได้รับมอบหมาย )?((?:RR|WO)-.+?)(?: เปลี่ยนสถานะเป็น .+)?$/)?.[1]
      : undefined;
    const lookup = row.entityId ? { _id: row.entityId } : legacyNumber ? { number: legacyNumber } : null;
    if (["repairRequests", "workOrders"].includes(module) || !module) {
      if (!lookup) continue;
      record = await findRecord(module || "repairRequests", lookup);
      if (!module && record) module = "repairRequests";
      if (!module && !record) {
        record = await findRecord("workOrders", lookup);
        module = "workOrders";
      }
      if (!record) continue;
      if (module === "workOrders" && actor.role === "requester") {
        const request = await findRecord("repairRequests", { _id: record.requestId });
        record.requesterId = request?.requesterId;
      }
      if (module === "repairRequests" && actor.role === "technician") {
        const order = await findRecord("workOrders", { requestId: record._id, assigneeIds: actor._id });
        record.assigneeIds = order?.assigneeIds || [];
      }
    }
    if (module === "inventory") {
      record = await findRecord("inventoryParts", { _id: row.entityId });
      if (!record) continue;
    }
    if (module === "pm") {
      record = await findRecord("pmOccurrences", { _id: row.entityId });
      if (!record) continue;
      record.assigneeIds = [record.assigneeId];
    }
    const target = {
      module, entityId: record?._id || row.entityId,
      companyId: record?.companyId || row.companyId, siteId: record?.siteId || row.siteId,
      requesterId: record?.requesterId, assigneeIds: record?.assigneeIds,
    };
    if (canReceiveNotification(actor, target))
      visible.push({ _id: row._id, module, entityId: target.entityId, message: displayDocumentNumberInMessage(row.message), actorName: typeof row.actorName === "string" ? row.actorName : undefined, at: row.at, read: row.read === true });
  }
  return visible;
}
function displayDocumentNumberInMessage(message: string) {
  message = message.replace(/(เปลี่ยนสถานะเป็น\s+)([a-z_]+)\b/g, (_, prefix: string, status: string) => `${prefix}${labels[status] || status}`);
  return message.replace(/(?:RR|WO)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-\d{4}-\d+/gi, displayDocumentNumber);
}
