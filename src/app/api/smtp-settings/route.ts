import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db,tx,type Row } from "@/lib/db";
import { user,origin,ApiError } from "@/lib/auth";
import { permitted } from "@/lib/permissions";
import { canManageSmtp,publicSmtpSettings,smtpSchema } from "@/lib/smtp-policy";
import { sealSmtpSecret,smtpEncryptionReady } from "@/lib/smtp-secret";
import { recoveryMailSettings,smtpTransport } from "@/lib/password-recovery-mail";
import { auditContext } from "@/lib/audit-context";
import { smtpFailure } from "@/lib/smtp-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function failure(error:unknown) {
  if(error instanceof ApiError)return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof z.ZodError)return NextResponse.json({error:error.issues[0]?.message||"กรุณาตรวจสอบข้อมูล"},{status:400});
  const reference=randomUUID(), diagnostic=smtpFailure(error);
  console.error("SMTP settings operation failed",{reference,code:diagnostic.code});
  return NextResponse.json({error:`${diagnostic.message} (อ้างอิง ${reference})`,code:diagnostic.code},{status:diagnostic.status});
}
export async function GET() {try{
  const actor=await user();
  if(actor.role!=="admin"||!permitted(actor,"smtp"))throw new ApiError(403,"ไม่มีสิทธิ์ตั้งค่า SMTP");
  const d=await db(), ids=[...new Set(actor.grants.map(g=>g.companyId))];
  const [companies,sites,configs]=await Promise.all([
    d.collection<Row>("companies").find({_id:{$in:ids},deletedAt:null},{projection:{name:1,nameTh:1}}).toArray(),
    d.collection<Row>("sites").find({companyId:{$in:ids},deletedAt:null}).toArray(),
    d.collection<Row>("smtpSettings").find({_id:{$in:ids}}).toArray(),
  ]);
  const allowed=companies.filter(c=>canManageSmtp(actor,c._id,sites as {_id:string;companyId:string}[]));
  return NextResponse.json({companies:allowed,configs:configs.filter(c=>allowed.some(a=>a._id===c._id)).map(publicSmtpSettings),encryptionReady:smtpEncryptionReady()},{headers:{"Cache-Control":"no-store"}});
}catch(error){return failure(error);}}
export async function POST(req:Request) {try{
  origin(req);const actor=await user();
  if(actor.role!=="admin"||!permitted(actor,"smtp","edit"))throw new ApiError(403,"ไม่มีสิทธิ์แก้ไข SMTP");
  const body=await req.json(),operation=z.object({action:z.enum(["save","test"]),companyId:z.string().min(1).max(100)}).parse(body);
  const d=await db(),sites=await d.collection<Row>("sites").find({companyId:operation.companyId,deletedAt:null}).toArray();
  if(!canManageSmtp(actor,operation.companyId,sites as {_id:string;companyId:string}[]))throw new ApiError(403,"ต้องมีสิทธิ์ครบทุกสาขาในบริษัทเพื่อจัดการ SMTP");
  if(operation.action==="test") {
    const limit=await d.collection<Row>("rateLimits").findOneAndUpdate({_id:`smtp-test:${actor._id}:${Math.floor(Date.now()/60000)}`},{$inc:{count:1},$setOnInsert:{expiresAt:new Date(Date.now()+120000)}},{upsert:true,returnDocument:"after"});
    if(limit!.count>5)throw new ApiError(429,"ทดสอบบ่อยเกินไป กรุณารอสักครู่");
    const transport=smtpTransport(await recoveryMailSettings(operation.companyId));
    try { await transport.verify(); } finally { transport.close(); }
    return NextResponse.json({ok:true});
  }
  const {action,...input}=body,value=smtpSchema.parse(input);
  await tx(async(dd,session)=>{
    await dd.collection<Row>("systemSettings").updateOne({_id:"admin-users-write-lock"},{$inc:{revision:1}},{upsert:true,session});
    const liveActor=await dd.collection<Row>("users").findOne({_id:actor._id,role:"admin",active:true},{session});
    const liveSites=await dd.collection<Row>("sites").find({companyId:value.companyId,deletedAt:null},{session}).toArray();
    if(!liveActor||!canManageSmtp({role:"admin",grants:liveActor.grants||[]},value.companyId,liveSites as {_id:string;companyId:string}[]))throw new ApiError(403,"สิทธิ์เปลี่ยนแล้ว กรุณารีเฟรช");
    const old=await dd.collection<Row>("smtpSettings").findOne({_id:value.companyId},{session});
    if((old?.revision||0)!==value.revision)throw new ApiError(409,"ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรชก่อนบันทึก");
    const {password,revision,...fields}=value;
    if(value.authEnabled&&password&&!smtpEncryptionReady())throw new ApiError(503,"ยังไม่มีกุญแจเข้ารหัสบนเซิร์ฟเวอร์ กรุณาติดต่อผู้ดูแลระบบ");
    const secret=value.authEnabled?(password?sealSmtpSecret(password):old?.secret||""):"";
    if(value.authEnabled&&!secret)throw new ApiError(400,"กรุณาระบุรหัสผ่าน SMTP");
    await dd.collection<Row>("smtpSettings").updateOne({_id:value.companyId},{$set:{...fields,username:value.authEnabled?value.username:"",secret,updatedAt:new Date(),updatedBy:actor._id},$inc:{revision:1}},{upsert:true,session});
    await dd.collection<Row>("auditLogs").insertOne({_id:randomUUID(),companyId:value.companyId,siteId:liveSites[0]._id,...auditContext(req),actorId:actor._id,actorName:actor.name,
      entityId:value.companyId,event:"smtp.saved",reference:value.host,detail:{enabled:value.enabled,passwordChanged:!!password},at:new Date()},{session});
  });
  return NextResponse.json({ok:true});
}catch(error){return failure(error);}}
