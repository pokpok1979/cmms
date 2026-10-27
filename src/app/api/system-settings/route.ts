import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, tx, Row } from "@/lib/db";
import { user, origin, ApiError, SESSION_DAYS } from "@/lib/auth";
import { scope } from "@/lib/domain";
import { userScopeQuery } from "@/lib/admin-users-policy";

import { auditContext } from "@/lib/audit-context";
import { canManageSettings, settingsId, settingsDefaults, settingsValues, settingsChangedFields, settingsSaveSchema, settingFieldLabels } from "@/lib/system-settings-policy";
import packageInfo from "../../../../package.json";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function respondError(error:unknown) {
  if(error instanceof ApiError)return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof z.ZodError)return NextResponse.json({error:error.issues[0]?.message || "กรุณาตรวจสอบข้อมูล"},{status:400});
  if((error as {code?:number})?.code===11000)return NextResponse.json({error:"การตั้งค่าถูกเปลี่ยนแล้ว กรุณารีเฟรชข้อมูลก่อนบันทึก"},{status:409});
  return NextResponse.json({error:"ดำเนินการตั้งค่าไม่สำเร็จ กรุณาลองใหม่"},{status:500});
}
export async function GET(req:Request) {
  try {
    const actor=await user(req);
    if(actor.role!=="admin")throw new ApiError(403,"ไม่มีสิทธิ์ตั้งค่าระบบ");
    const d=await db(),params=new URL(req.url).searchParams;
    const [sites,companies]=await Promise.all([
      d.collection<Row>("sites").find({...scope(actor),deletedAt:null},{projection:{name:1,companyId:1,siteId:1}}).sort({name:1}).toArray(),
      Promise.resolve([] as Row[]),
    ]);
    const choices=sites.map(site=>({companyId:site.companyId,siteId:site.siteId || site._id,name:site.name,companyName:companies.find(company=>company._id===site.companyId)?.nameTh || companies.find(company=>company._id===site.companyId)?.name || site.companyId}));
    const requested=params.get("siteId");
    const target=requested?choices.find(site=>site.siteId===requested&&site.companyId===params.get("companyId")):choices[0];
    if(requested&&!target)throw new ApiError(404,"ไม่พบโรงงานหรือไม่มีสิทธิ์ตั้งค่า");
    const countable=[
      ["users","ผู้ใช้งาน",userScopeQuery(actor)],
      ["sites","โรงงาน / สถานที่",{...scope(actor),deletedAt:null}],
      ["locations","พื้นที่ / อาคาร",{...scope(actor),deletedAt:null}],
      ["assets","เครื่องจักร",{...scope(actor),deletedAt:null}],
      ["repairRequests","ใบแจ้งซ่อม",scope(actor)],
      ["workOrders","ใบงานซ่อม",scope(actor)],
      ["workLogs","บันทึกการทำงาน",scope(actor)],
      ["attachments","ไฟล์แนบ",scope(actor)],
      ["auditLogs","บันทึกกิจกรรม",scope(actor)],
    ] as const;
    const [totals,record,history]=await Promise.all([
      Promise.all(countable.map(async([collection,label,match])=>{
        const result=await d.collection(collection).aggregate([{$match:match},{$group:{_id:null,count:{$sum:1},bytes:{$sum:{$bsonSize:"$$ROOT"}}}}]).next();
        return {collection,label,count:result?.count || 0,bytes:result?.bytes || 0};
      })),
      target?d.collection<Row>("systemSettings").findOne({_id:settingsId(target.companyId,target.siteId),companyId:target.companyId,siteId:target.siteId}):null,
      target?d.collection<Row>("auditLogs").find({companyId:target.companyId,siteId:target.siteId,event:"settings.updated"},{projection:{at:1,actorName:1,detail:1}}).sort({at:-1}).limit(5).toArray():[],
    ]);
    const selectedCompany=companies.find(company=>company._id===target?.companyId);
    const companyDefaults=settingsValues({companyNameEn:selectedCompany?.nameEn,phone:selectedCompany?.phone,email:selectedCompany?.email,website:selectedCompany?.website,address:selectedCompany?.address},settingsDefaults(target?.companyName || "",target?.name || ""));
    return NextResponse.json({
      sites:choices,settings:target?{...settingsValues(record || {},companyDefaults),companyId:target.companyId,siteId:target.siteId,revision:record?.revision || 0,updatedAt:record?.updatedAt || null}:null,
      stats:{bytes:totals.reduce((sum,row)=>sum+row.bytes,0),collections:totals.length,users:totals.find(row=>row.collection==="users")?.count || 0,audits:totals.find(row=>row.collection==="auditLogs")?.count || 0,totals},
      system:{application:"AGE CMMS",version:packageInfo.version,node:process.version,database:"MongoDB",databaseName:d.databaseName,timezone:"Asia/Bangkok",serverTime:new Date().toISOString(),sessionDays:SESSION_DAYS,mode:process.env.NODE_ENV || "development"},history,
    });
  }catch(error){return respondError(error);}
}
export async function POST(req:Request) {
  try {
    origin(req);
    const actor=await user(req);
    if(actor.role!=="admin")throw new ApiError(403,"ไม่มีสิทธิ์ตั้งค่าระบบ");
    const value=settingsSaveSchema.parse(await req.json());
    if(!canManageSettings(actor,value))throw new ApiError(403,"ไม่มีสิทธิ์ตั้งค่าอาคาร/โรงงานนี้");
    const result=await tx(async(d,session)=>{
      const site=await d.collection<Row>("sites").findOne({_id:value.siteId,companyId:value.companyId,siteId:value.siteId,deletedAt:null},{session});
      if(!site)throw new ApiError(404,"ไม่พบโรงงาน");

      const id=settingsId(value.companyId,value.siteId);
      const old=await d.collection<Row>("systemSettings").findOne({_id:id,companyId:value.companyId,siteId:value.siteId},{session});
      if((old?.revision || 0)!==value.revision)throw new ApiError(409,"การตั้งค่าถูกเปลี่ยนแล้ว กรุณารีเฟรชข้อมูลก่อนบันทึก");
      const defaults=settingsDefaults(value.companyId,site.name);
      const previous=settingsValues(old || {},defaults),next=settingsValues(value,defaults);
      const fields=settingsChangedFields(previous,next);
      if(!fields.length&&old)return {changed:false,revision:value.revision};
      const now=new Date(),record={...next,companyId:value.companyId,siteId:value.siteId,revision:value.revision+1,updatedAt:now,updatedBy:actor._id};
      if(old){
        const update=await d.collection<Row>("systemSettings").updateOne({_id:id,revision:value.revision},{$set:record},{session});
        if(!update.modifiedCount)throw new ApiError(409,"การตั้งค่าถูกเปลี่ยนแล้ว กรุณารีเฟรชข้อมูลก่อนบันทึก");
      }else await d.collection<Row>("systemSettings").insertOne({_id:id,...record,createdAt:now},{session});
      if(site.name!==next.plantName)await d.collection<Row>("sites").updateOne({_id:value.siteId,companyId:value.companyId,siteId:value.siteId},{$set:{name:next.plantName,updatedAt:now}},{session});
      await d.collection<Row>("auditLogs").insertOne({
        _id:randomUUID(),companyId:value.companyId,siteId:value.siteId,entityId:id,entityType:"settings",actorId:actor._id,actorName:actor.name,
        ip:auditContext(req).ip,event:"settings.updated",reference:`${next.companyNameTh} / ${next.plantName}`,at:now,
        detail:{changedFields:fields,note:fields.length?fields.map(field=>settingFieldLabels[field]).join(", "):"บันทึกการตั้งค่าเริ่มต้น",changes:fields.map(field=>({field,label:settingFieldLabels[field],from:previous[field],to:next[field]}))},
      },{session});
      return {changed:true,revision:record.revision};
    });
    return NextResponse.json({ok:true,...result});
  }catch(error){return respondError(error);}
}
