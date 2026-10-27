import type { User } from "./domain";
export const userRoles = ["requester", "technician", "supervisor", "executive", "admin"] as const;
export const userRoleLabels: Record<string, string> = {
  requester: "ผู้แจ้งซ่อม", technician: "ช่าง / ผู้รับผิดชอบ",
  supervisor: "หัวหน้างานซ่อมบำรุง", executive: "ผู้บริหาร", admin: "ผู้ดูแลระบบ",
};
export type Grant = { companyId: string; siteId: string };
export function canManageUser(actor: Pick<User, "role" | "grants">, grants: Grant[]) {
  return actor.role === "admin" && grants.length > 0 && grants.every(target => actor.grants.some(g => g.companyId === target.companyId && g.siteId === target.siteId));
}
export function userScopeQuery(actor: Pick<User, "role" | "grants">) {
  if (actor.role !== "admin" || !actor.grants.length) return { _id: { $in: [] } };
  return { "grants.0": { $exists: true }, grants: { $not: { $elemMatch: { $nor: actor.grants.map(g => ({ companyId: g.companyId, siteId: g.siteId })) } } } };
}
export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
export function escapeUserSearch(text: string) { return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
