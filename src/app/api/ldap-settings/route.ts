import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { user,origin,ApiError } from "@/lib/auth";
import { db,tx,type Row } from "@/lib/db";
import { canSetupLdap,ldapConfigSchema,ldapLoginName } from "@/lib/ldap-policy";
import { sealLdapSecret } from "@/lib/ldap-secret";
import { readLdap,type StoredLdapConfig } from "@/lib/ldap-client";
import { auditContext } from "@/lib/audit-context";
import { permitted,type PermissionAction } from "@/lib/permissions";
import { ldapFailure } from "@/lib/ldap-errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function error(e:unknown,stage="load"){
  if(e instanceof ApiError)return NextResponse.json({error:e.message},{status:e.status});
  if(e instanceof z.ZodError)return NextResponse.json({error:e.issues[0]?.message},{status:400});
  const failure=ldapFailure(e,stage),reference=randomUUID();
  const raw=e as {name?:string;code?:unknown};
  console.error("LDAP operation failed",{reference,stage,code:failure.code,errorType:/^[A-Za-z]+Error$/.test(raw?.name||"")?raw.name:"Error",sourceCode:typeof raw?.code==="number"?raw.code:undefined});
  return NextResponse.json({error:`${failure.message} [${failure.code}] อ้างอิง ${reference}`,code:failure.code,stage,reference},{status:failure.status});
}
async function access(companyId:string,action:PermissionAction){
  const actor=await user();if(actor.role!=="admin"||!permitted(actor,"ldap",action))throw new ApiError(403,"ไม่มีสิทธิ์ตั้งค่า LDAP");
  const d=await db(),sites=await d.collection<Row>("sites").find({companyId,deletedAt:null}).toArray();
  if(!canSetupLdap(actor,companyId,sites))throw new ApiError(403,"ต้องมีสิทธิ์ครบทุกสาขาในบริษัทเพื่อจัดการ LDAP");
  return {actor,d,sites};
}
export async function GET(){try{
  const actor=await user();if(actor.role!=="admin"||!permitted(actor,"ldap"))throw new ApiError(403,"ไม่มีสิทธิ์");
  const d=await db(),ids=[...new Set(actor.grants.map(g=>g.companyId))];
  const [companies,sites,configs]=await Promise.all([
    d.collection<Row>("companies").find({_id:{$in:ids},deletedAt:null},{projection:{name:1,nameTh:1,code:1}}).toArray(),
    d.collection<Row>("sites").find({companyId:{$in:ids},deletedAt:null}).toArray(),
    d.collection<Row>("ldapSettings").find({companyId:{$in:ids}}).toArray(),
  ]);
  const allowed=companies.filter(c=>canSetupLdap(actor,c._id,sites.filter(s=>s.companyId===c._id)));
  return NextResponse.json({companies:allowed,sites:sites.filter(s=>allowed.some(c=>c._id===s.companyId)),configs:configs.filter(s=>allowed.some(c=>c._id===s.companyId)).map(({secret,...config})=>({...config,hasPassword:!!secret})),encryptionReady:/^[a-f0-9]{64}$/i.test(process.env.LDAP_ENCRYPTION_KEY||"")});
}catch(e){return error(e);}}
export async function POST(req:Request){let stage="request";try{
  origin(req);const body=await req.json();
  const operation=z.object({action:z.enum(["save","test","sync"]),companyId:z.string().min(1).max(100)}).parse(body);
  const {actor,d,sites}=await access(operation.companyId,"edit");
  if(operation.action!=="test"){
    stage="indexes";
    // Remove the obsolete unique prefix index so multiple companies can save settings without a prefix.
    if ((await d.listCollections({name:"ldapSettings"}).toArray()).length) {
      for (const index of await d.collection("ldapSettings").listIndexes().toArray()) {
        if (index.name && Object.keys(index.key).length===1 && index.key.loginPrefix===1)
          await d.collection("ldapSettings").dropIndex(index.name).catch(e=>{if(e?.code!==27)throw e;});
      }
    }
    await d.collection("users").createIndex({ldapCompanyId:1,ldapAccount:1},{unique:true,partialFilterExpression:{ldapCompanyId:{$type:"string"},ldapAccount:{$type:"string"}}});
  }
  stage=operation.action;
  if(operation.action==="save"){
    const {action,...input}=body;const value=ldapConfigSchema.parse(input);
    if(!sites.some(s=>s._id===value.siteId))throw new ApiError(400,"สาขาไม่อยู่ในบริษัทที่เลือก");
    if(!/^[a-f0-9]{64}$/i.test(process.env.LDAP_ENCRYPTION_KEY||""))throw new ApiError(503,"กรุณาตั้งค่า LDAP_ENCRYPTION_KEY บนเซิร์ฟเวอร์ก่อนบันทึก");
    await tx(async(dd,s)=>{
      await dd.collection<Row>("systemSettings").updateOne({_id:"admin-users-write-lock"},{$inc:{revision:1}},{upsert:true,session:s});
      const liveActor=await dd.collection<Row>("users").findOne({_id:actor._id,active:true,role:"admin"},{session:s});
      const liveSites=await dd.collection<Row>("sites").find({companyId:value.companyId,deletedAt:null},{session:s}).toArray();
      if(!liveActor||!canSetupLdap({role:"admin",grants:liveActor.grants||[]},value.companyId,liveSites))throw new ApiError(403,"สิทธิ์บริษัทเปลี่ยนแล้ว กรุณารีเฟรช");
      const old=await dd.collection<Row>("ldapSettings").findOne({_id:value.companyId},{session:s});
      if((old?.revision||0)!==value.revision)throw new ApiError(409,"ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรช");
      const {bindPassword,revision,...fields}=value,secret=bindPassword?sealLdapSecret(bindPassword):old?.secret;
      if(!secret)throw new ApiError(400,"กรุณาระบุรหัสผ่านบัญชีเชื่อมต่อ");
      await dd.collection<Row>("ldapSettings").updateOne({_id:value.companyId},{$set:{...fields,secret,updatedAt:new Date(),updatedBy:actor._id},$inc:{revision:1}},{upsert:true,session:s});
      await dd.collection<Row>("auditLogs").insertOne({_id:randomUUID(),companyId:value.companyId,siteId:value.siteId,...auditContext(req),actorId:actor._id,actorName:actor.name,entityId:value.companyId,entityType:"ldap",event:"ldap.saved",detail:{enabled:value.enabled,mode:value.mode,verifyTlsCertificate:value.verifyTlsCertificate,ldapTransport:value.ldapTransport,passwordChanged:!!bindPassword},at:new Date()},{session:s});
    });return NextResponse.json({ok:true});
  }
  const config=await d.collection<Row>("ldapSettings").findOne({_id:operation.companyId});
  if(!config)throw new ApiError(400,"กรุณาบันทึกการตั้งค่าก่อน");
  if(operation.action==="sync"&&(!config.enabled||!permitted(actor,"users","create")||!permitted(actor,"users","edit")))throw new ApiError(403,"กรุณาเปิดใช้ LDAP และสิทธิ์สร้าง/แก้ไขผู้ใช้ก่อนซิงก์");
  stage="ldap-connect-search";
  const entries=await readLdap(config as unknown as StoredLdapConfig);
  if(operation.action==="test")return NextResponse.json({ok:true,count:entries.length});
  stage="sync-users";
  const result=await tx(async(dd,s)=>{
    await dd.collection<Row>("systemSettings").updateOne({_id:"admin-users-write-lock"},{$inc:{revision:1}},{upsert:true,session:s});
    const liveActor=await dd.collection<Row>("users").findOne({_id:actor._id,active:true,role:"admin"},{session:s});
    const liveSites=await dd.collection<Row>("sites").find({companyId:config.companyId,deletedAt:null},{session:s}).toArray();
    if(!liveActor||!canSetupLdap({role:"admin",grants:liveActor.grants||[]},config.companyId,liveSites))throw new ApiError(403,"สิทธิ์บริษัทเปลี่ยนแล้ว กรุณารีเฟรช");
    const current=await dd.collection<Row>("ldapSettings").findOne({_id:config._id,revision:config.revision,enabled:true},{session:s});
    if(!current)throw new ApiError(409,"การตั้งค่าเปลี่ยนแล้ว กรุณาซิงก์ใหม่");
    if(!await dd.collection<Row>("sites").findOne({_id:config.siteId,companyId:config.companyId,deletedAt:null},{session:s}))throw new ApiError(409,"สาขาหรือแผนกถูกลบ กรุณาตั้งค่าใหม่");
    let created=0,updated=0,skipped=0;
    for(const entry of entries){
      let username:string;try{username=ldapLoginName(entry.account);}catch{skipped++;continue;}
      if(!entry.name.trim()||entry.name.length>200||entry.department.length>120||entry.position.length>120||entry.email.length>254||entry.email&&!z.email().safeParse(entry.email).success){skipped++;continue;}
      const old=await dd.collection<Row>("users").findOne({ldapCompanyId:config.companyId,ldapAccount:entry.account.toLowerCase()},{session:s});
      if(old&&(old.grants||[]).some((g:{companyId:string;siteId:string})=>!actor.grants.some(a=>a.companyId===g.companyId&&a.siteId===g.siteId))){skipped++;continue;}
      const duplicate=await dd.collection<Row>("users").findOne({_id:{$ne:old?._id||""},$or:[{username},...(entry.email?[{email:entry.email}]:[])]},{session:s});
      if(duplicate){skipped++;continue;}
      const accountId=old?._id||randomUUID();
      await dd.collection<Row>("users").updateOne({_id:accountId},{$set:{username,name:entry.name.trim(),email:entry.email,ldapCompanyId:config.companyId,ldapAccount:entry.account.toLowerCase(),authSource:"local",department:entry.department,position:entry.position,ldapSyncedAt:new Date()},$unset:{departmentId:""},$setOnInsert:{role:"requester",active:false,grants:[{companyId:config.companyId,siteId:config.siteId}],phone:"",createdAt:new Date()}},{upsert:true,session:s});
      if(old)updated++;else created++;
    }
    await dd.collection<Row>("ldapSettings").updateOne({_id:config._id},{$set:{lastSyncAt:new Date(),lastSyncResult:{created,updated,skipped}}},{session:s});
    await dd.collection<Row>("auditLogs").insertOne({_id:randomUUID(),companyId:config.companyId,siteId:config.siteId,...auditContext(req),actorId:actor._id,actorName:actor.name,entityId:config.companyId,entityType:"ldap",event:"ldap.synced",detail:{created,updated,skipped},at:new Date()},{session:s});
    return {created,updated,skipped};
  });return NextResponse.json({ok:true,...result});
}catch(e){return error(e,stage);}}
