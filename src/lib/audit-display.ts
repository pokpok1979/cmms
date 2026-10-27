import { labels } from "./domain";

export const auditModules: Record<string, string> = {
  inventory: "คลังอะไหล่",
  pm: "บำรุงรักษา PM",
  roles: "สิทธิ์บทบาท",
  ldap: "ตั้งค่า LDAP / AD",
  settings: "ตั้งค่าระบบ",
  workTypes: "ประเภทงาน",
  companies: "บริษัท",
  login: "การเข้าสู่ระบบ", repairRequests: "ใบแจ้งซ่อม", workOrders: "ใบงานซ่อม",
  assets: "เครื่องจักร", locations: "สถานที่", users: "ผู้ใช้งาน", profile: "ข้อมูลส่วนตัว",
};
export const auditActions: Record<string, string> = {
  "inventory.part.created": "เพิ่มอะไหล่", "inventory.part.updated": "แก้ไขอะไหล่",
  "inventory.receipt": "รับเข้า", "inventory.issue": "เบิกใช้", "inventory.return": "คืนอะไหล่",
  "pm.plan.updated": "แก้ไขแผน", "pm.plan.status": "เปิด/พักแผน", "pm.photo.added": "แนบรูป", "pm.defect.created": "สร้างใบแจ้งซ่อมจากผลตรวจ",
  "pm.plan.created": "สร้างแผน", "pm.plan.toggled": "เปิด/พักแผน", "pm.completed": "บันทึกผลตรวจ",
  "roles.updated": "แก้ไข",
  "ldap.saved": "บันทึก", "ldap.synced": "ซิงก์รายชื่อ",
  "settings.updated": "แก้ไข",
  "company.created": "เพิ่ม", "company.updated": "แก้ไข", "company.deleted": "ลบ",
  "workType.created": "เพิ่ม", "workType.updated": "แก้ไข", "workType.deleted": "ลบ",
  "login": "เข้าสู่ระบบ", "logout": "ออกจากระบบ", "request.created": "สร้าง",
  "workOrder.created": "สร้าง", "user.created": "สร้าง", "user.updated": "แก้ไข",
  "user.password.changed": "เปลี่ยนรหัสผ่าน", "profile": "แก้ไข",
  "master.saved": "บันทึก", "status.changed": "เปลี่ยนสถานะ", "request.progress": "เปลี่ยนสถานะ",
  "comment.added": "เพิ่มความคิดเห็น", "log.added": "บันทึกการทำงาน", "attachment.added": "แนบไฟล์",
};
export function auditModule(event: string, entityType?: string, kind?: string) {
  if (event === "login" || event === "logout") return "login";
  if (event.startsWith("inventory.")) return "inventory";
  if (event.startsWith("pm.")) return "pm";
  if (event.startsWith("user.")) return "users";
  if (event === "profile") return "profile";
  if (event.startsWith("request.")) return "repairRequests";
  if (event.startsWith("workOrder.") || event === "log.added") return "workOrders";
  return entityType || kind || "other";
}
export type AuditDetail = { from?: string; to?: string; next?: string; note?: string; costSatang?: number; changedFields?: string[]; kind?: string };
export function auditDescription(event: string, module: string, reference: string, detail: AuditDetail = {}) {
  const action = auditActions[event] || event;
  const target = auditModules[module] || "รายการ";
  if (event === "login" || event === "logout") return action;
  if (event === "status.changed" || event === "request.progress") {
    const status = [detail.from, detail.to || detail.next].filter(Boolean).map(x => labels[x!] || x).join(" → ");
    return `${action}${target} ${reference}${status ? `: ${status}` : ""}${detail.note ? ` · ${detail.note}` : ""}`;
  }
  if (event === "log.added") return `${action} ${reference}${typeof detail.costSatang === "number" ? ` · ค่าใช้จ่าย ${(detail.costSatang / 100).toLocaleString("th-TH")} บาท` : ""}`;
  return `${action}${target} ${reference}${detail.note ? ` · ${detail.note}` : ""}`.trim();
}
