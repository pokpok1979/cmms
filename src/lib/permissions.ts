import type { Role } from "./domain";
export const actions = ["view", "create", "edit", "delete", "approve"] as const;
export type PermissionAction = typeof actions[number];
export const actionLabels = ["ดูข้อมูล", "สร้างรายการ", "แก้ไข", "ลบ", "อนุมัติ"];
export const modules = [
  ["inventory", "คลังอะไหล่"],
  ["pm", "บำรุงรักษา PM"], ["dashboard", "แดชบอร์ด"], ["repairRequests", "ใบแจ้งซ่อม"], ["workOrders", "ใบงานซ่อม"],
  ["assets", "ทะเบียนเครื่องจักร"], ["companies", "บริษัท"], ["sites", "อาคาร/โรงงาน/สาขา"],
  ["locations", "สถานที่"], ["workTypes", "ประเภทงาน"],
  ["users", "จัดการผู้ใช้"], ["auditLogs", "ประวัติการเปลี่ยนแปลง"], ["settings", "ตั้งค่าระบบ"],
  ["ldap", "ตั้งค่า LDAP / AD"], ["smtp", "ตั้งค่า SMTP"],
] as const;
export type Matrix = Record<string, Record<PermissionAction, boolean>>;
export function permissionChanges(before?: Matrix, after?: Matrix) {
  return modules.flatMap(([module, label]) => actions.flatMap((action, index) => {
    const from = before?.[module]?.[action] === true, to = after?.[module]?.[action] === true;
    return from === to ? [] : [{ module, moduleLabel: label, action, actionLabel: actionLabels[index], from, to }];
  }));
}
export function defaultPermissions(role: Role): Matrix {
  const admin = role === "admin", manager = admin || role === "supervisor";
  return Object.fromEntries(modules.map(([module]) => {
    let allowed: readonly string[] = [];
    if (module === "dashboard") allowed = ["view"];
    else if (module === "inventory") allowed = manager ? ["view", "create", "edit"] : role === "technician" ? ["view", "edit"] : role === "executive" ? ["view"] : [];
    else if (module === "pm") allowed = manager ? ["view", "create", "edit"] : role === "technician" ? ["view", "edit"] : role === "executive" ? ["view"] : [];
    else if (module === "assets") allowed = manager ? ["view", "create", "edit", "delete"] : ["view"];
    else if (module === "repairRequests") allowed = role === "executive" ? ["view"] : manager ? ["view", "create", "edit", "approve"] : ["view", "create", "edit"];
    else if (module === "workOrders") allowed = manager ? ["view", "edit", "approve"] : role === "technician" ? ["view", "edit"] : ["view"];
    else if (module === "auditLogs") allowed = admin ? ["view"] : [];
    else if (["settings","ldap","smtp"].includes(module)) allowed = admin ? ["view", "edit"] : [];
    else allowed = admin ? ["view", "create", "edit", "delete"] : [];
    return [module, Object.fromEntries(actions.map(action => [action, allowed.includes(action)]))];
  })) as Matrix;
}
export function resolvePermissions(role: Role, saved?: Matrix): Matrix {
  const base = defaultPermissions(role);
  for (const [module] of modules) for (const action of actions)
    // Older policies shared the system-settings permission with LDAP and SMTP.
    base[module][action] = base[module][action] && (saved?.[module]?.[action] ?? (["ldap","smtp"].includes(module) ? saved?.settings?.[action] : undefined) ?? true);
  return base;
}
export function permitted(user: { role: Role; permissions?: Matrix }, module: string, action: PermissionAction = "view") {
  return resolvePermissions(user.role, user.permissions)[module]?.[action] === true;
}
export async function requestPermission(req: Request): Promise<{ module: string; action: PermissionAction } | null> {
  const path = new URL(req.url).pathname.split("/").filter(Boolean).slice(1);
  let module = ({ "pm3": "pm", "dashboard-overview": "dashboard", "audit-history": "auditLogs", "admin-users": "users", "system-settings": "settings", "ldap-settings":"ldap", "smtp-settings":"smtp", "work-types": "workTypes" } as Record<string,string>)[path[0]] || path[0];
  if (module !== "masters" && !modules.some(([key]) => key === module)) return null;
  if (path[0] === "pm3" && path[1] === "photos") return { module: "pm", action: req.method === "GET" ? "view" : "edit" };
  const body = req.method === "GET" ? {} : await req.clone().json().catch(() => ({}));
  if (module === "inventory") return { module, action: req.method === "GET" ? "view" : body.action === "save" && !body.id ? "create" : "edit" };
  if (module === "pm") return { module, action: req.method === "GET" ? "view" : ["create", "generate"].includes(body.action) || (body.action === "save" && !body.id) ? "create" : "edit" };
  if (module === "masters") module = req.method === "GET" ? new URL(req.url).searchParams.get("kind") || "" : body.kind;
  if (!modules.some(([key]) => key === module)) return null;
  let action: PermissionAction = "view";
  if (req.method !== "GET") {
    action = path.includes("delete") || body.action === "delete" ? "delete" :
      body.next && ["approved", "rejected", "completed"].includes(body.next) ? "approve" :
      body.id || path[1] || ["settings","ldap","smtp"].includes(module) ? "edit" : "create";
  }
  return { module, action };
}
