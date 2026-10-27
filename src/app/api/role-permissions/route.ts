import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { user, origin, ApiError } from "@/lib/auth";
import { db, tx, Row } from "@/lib/db";
import { userRoles } from "@/lib/admin-users-policy";
import { actions, modules, defaultPermissions, resolvePermissions, permissionChanges } from "@/lib/permissions";
import { scope } from "@/lib/domain";
import { auditContext } from "@/lib/audit-context";
const schema = z.object({ role: z.enum(userRoles), revision: z.number().int().nonnegative(), matrix: z.record(z.string(), z.object({ view:z.boolean(), create:z.boolean(), edit:z.boolean(), delete:z.boolean(), approve:z.boolean() }).strict()) }).strict();
function error(e: unknown) { return NextResponse.json({ error: e instanceof ApiError ? e.message : e instanceof z.ZodError ? "ข้อมูลสิทธิ์ไม่ถูกต้อง" : "ดำเนินการไม่สำเร็จ" }, {status: e instanceof ApiError ? e.status : e instanceof z.ZodError ? 400 : 500}); }
export async function GET(req: Request) {
  try {
    const actor = await user();
    if (actor.role !== "admin" || !actor.grants.length) throw new ApiError(403,"เฉพาะผู้ดูแลระบบที่มีขอบเขตสิทธิ์");
    const d = await db();
    const params = new URL(req.url).searchParams;
    if (params.has("historyRole")) {
      const role = z.enum(userRoles).parse(params.get("historyRole"));
      const page = z.coerce.number().int().min(1).max(100000).parse(params.get("page") || 1);
      const filter = { event:"roles.updated", entityType:"roles", entityId:role, ...scope(actor) };
      const [items, total] = await Promise.all([
        d.collection<Row>("auditLogs").find(filter, {projection:{actorName:1,actorId:1,at:1,detail:1}}).sort({at:-1,_id:-1}).skip((page-1)*20).limit(20).toArray(),
        d.collection<Row>("auditLogs").countDocuments(filter),
      ]);
      return NextResponse.json({items:items.map(row=>({_id:row._id,actorName:row.actorName || row.actorId,at:row.at,changes:permissionChanges(row.detail?.before,row.detail?.after)})),total,page});
    }
    const rows = await d.collection<Row>("rolePermissions").find({}).toArray();
    return NextResponse.json({ roles: userRoles.map(role => {
      const row = rows.find(x => x._id === role);
      return { role, matrix:resolvePermissions(role,row?.matrix), revision:row?.revision || 0 };
    }) }, {headers:{"Cache-Control":"no-store"}});
  } catch(e) { return error(e); }
}
export async function POST(req: Request) {
  try {
    origin(req); const actor = await user();
    if (actor.role !== "admin" || !actor.grants.length) throw new ApiError(403,"เฉพาะผู้ดูแลระบบที่มีขอบเขตสิทธิ์");
    const value = schema.parse(await req.json()), base = defaultPermissions(value.role);
    if (Object.keys(value.matrix).length !== modules.length || modules.some(([key]) => !value.matrix[key])) throw new ApiError(400,"กรุณาระบุสิทธิ์ให้ครบทุกโมดูล");
    for (const [key] of modules) for (const action of actions) {
      if (value.matrix[key][action] && !base[key][action]) throw new ApiError(400,"สิทธิ์นี้ไม่รองรับสำหรับบทบาทที่เลือก");
      if (action !== "view" && value.matrix[key][action] && !value.matrix[key].view) throw new ApiError(400,"กรุณาเปิดสิทธิ์ดูข้อมูลก่อน");
    }
    await tx(async(d,s) => {
      const old = await d.collection<Row>("rolePermissions").findOne({_id:value.role},{session:s});
      if ((old?.revision || 0) !== value.revision) throw new ApiError(409,"สิทธิ์มีการเปลี่ยนแปลง กรุณารีเฟรชก่อนบันทึก");
      await d.collection<Row>("rolePermissions").updateOne({_id:value.role},{$set:{matrix:value.matrix,updatedAt:new Date(),updatedBy:actor._id},$inc:{revision:1}},{upsert:true,session:s});
      await d.collection<Row>("auditLogs").insertOne({_id:randomUUID(),...actor.grants[0],...auditContext(req),entityId:value.role,entityType:"roles",actorId:actor._id,actorName:actor.name,event:"roles.updated",reference:value.role,detail:{before:old?.matrix || base,after:value.matrix},at:new Date()},{session:s});
    });
    return NextResponse.json({ok:true});
  } catch(e) { return error(e); }
}
