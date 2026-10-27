import { inScope, type User } from "./domain";
import { permitted } from "./permissions";

export type NotificationTarget = {
  module: string; entityId: string; companyId: string; siteId: string;
  requesterId?: string; assigneeIds?: string[];
};
export function canReceiveNotification(user: User, target: NotificationTarget) {
  if (!inScope(user, target)) return false;
  if (target.module === "roles") return user.role === "admin" && permitted(user, "users");
  if (!permitted(user, target.module)) return false;
  if (target.module === "repairRequests") {
    if (user.role === "requester") return target.requesterId === user._id;
    if (user.role === "technician") return target.assigneeIds?.includes(user._id) === true;
  }
  if (target.module === "pm" && user.role === "technician") return target.assigneeIds?.includes(user._id) === true;
  if (target.module === "workOrders") {
    if (user.role === "requester") return target.requesterId === user._id;
    if (user.role === "technician") return target.assigneeIds?.includes(user._id) === true;
  }
  return true;
}
