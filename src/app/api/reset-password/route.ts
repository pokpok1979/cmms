import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db, tx, type Row } from "@/lib/db";
import { origin, ApiError, hashPassword, digest } from "@/lib/auth";
import { passwordResetSchema } from "@/lib/password-recovery-policy";
import { finishPasswordReset } from "@/lib/password-recovery";
import { auditContext } from "@/lib/audit-context";

export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    origin(req);
    const input = passwordResetSchema.safeParse(await req.json().catch(()=>null));
    if (!input.success) return NextResponse.json({error:input.error.issues[0]?.message || "ข้อมูลไม่ถูกต้อง"},{status:400});
    const database = await db(), now = Date.now();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
    const limit = await database.collection<Row>("rateLimits").findOneAndUpdate({_id:`reset:${digest(ip)}:${Math.floor(now/900000)}`},
      {$inc:{count:1},$setOnInsert:{expiresAt:new Date(now+1800000)}},{upsert:true,returnDocument:"after"});
    if (limit!.count>30) return NextResponse.json({error:"ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลัง"},{status:429});
    const value = input.data, passwordHash = hashPassword(value.password);
    await tx(async(d,session)=>{
      await d.collection<Row>("systemSettings").updateOne({_id:"admin-users-write-lock"},{$inc:{revision:1}},{upsert:true,session});
      const account = await finishPasswordReset(d,session,value.token,passwordHash);
      const grant = account.grants?.[0];
      if (grant) await d.collection<Row>("auditLogs").insertOne({_id:randomUUID(),...grant,...auditContext(req),
        entityType:"users",entityId:account._id,actorId:account._id,actorName:account.name,reference:account.username,
        event:"user.password.changed",detail:{method:"email-recovery"},at:new Date()},{session});
    });
    return NextResponse.json({ok:true});
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:"ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่"},{status:500});
  }
}
