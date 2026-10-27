import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db,tx,Row } from "@/lib/db";
import { user,origin,ApiError } from "@/lib/auth";
import { scope } from "@/lib/domain";
import { auditContext } from "@/lib/audit-context";
import { readWorkTypes,ensureWorkTypeIndex,initializeWorkTypes } from "@/lib/work-types";
import { canManageWorkTypes,workTypeChangeSchema,workTypeNameKey } from "@/lib/work-types-policy";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function errorResponse(error:unknown){
  if(error instanceof ApiError)return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof z.ZodError)return NextResponse.json({error:error.issues[0]?.message || "กรุณาตรวจสอบข้อมูลประเภทงาน"},{status:400});
  if((error as {code?:number})?.code===11000)return NextResponse.json({error:"ประเภทงานชื่อนี้มีอยู่แล้วในโรงงาน"},{status:409});
  return NextResponse.json({error:"ดำเนินการประเภทงานไม่สำเร็จ กรุณาลองใหม่"},{status:500});
}
export async function GET(req:Request){
  try{
    const actor=await user(req);if(actor.role!=="admin")throw new ApiError(403,"ไม่มีสิทธิ์จัดการประเภทงาน");
    const d=await db(),params=new URL(req.url).searchParams;
    const sites=await d.collection<Row>("sites").find({...scope(actor),deletedAt:null},{projection:{companyId:1,siteId:1,name:1}}).sort({name:1}).toArray();
    const target=params.get("siteId")?sites.find(site=>site.siteId===params.get("siteId")&&site.companyId===params.get("companyId")):sites[0];
    if(params.get("siteId")&&!target)throw new ApiError(404,"ไม่พบโรงงานหรือไม่มีสิทธิ์");
    const choices=target?await readWorkTypes(d,{grants:[{companyId:target.companyId,siteId:target.siteId}]}):[];
    const q=params.get("q")?.trim().toLowerCase() || "";
    const items=q?choices.filter(row=>(row.name+" "+row.description).toLowerCase().includes(q)):choices;
    return NextResponse.json({items,total:items.length,sites,companyId:target?.companyId || "",siteId:target?.siteId || ""});
  }catch(error){return errorResponse(error);}
}
export async function POST(req:Request){
  try{
    origin(req);const actor=await user(req);if(actor.role!=="admin")throw new ApiError(403,"ไม่มีสิทธิ์จัดการประเภทงาน");
    const value=workTypeChangeSchema.parse(await req.json());
    if(!canManageWorkTypes(actor,value))throw new ApiError(403,"ไม่มีสิทธิ์จัดการประเภทงานในโรงงานนี้");
    const d=await db();await ensureWorkTypeIndex(d);
    await tx(async(dd,session)=>{
      const site=await dd.collection<Row>("sites").findOne({_id:value.siteId,companyId:value.companyId,siteId:value.siteId,deletedAt:null},{session});
      if(!site)throw new ApiError(404,"ไม่พบโรงงาน");
      await initializeWorkTypes(dd,value.companyId,value.siteId,session);
      const id=value.id || randomUUID();
      const old=value.id?await dd.collection<Row>("workTypes").findOne({_id:id,companyId:value.companyId,siteId:value.siteId,deletedAt:null},{session}):null;
      if(value.id&&!old)throw new ApiError(404,"ไม่พบประเภทงานหรือถูกลบแล้ว");
      if((old?.revision || 0)!==value.revision)throw new ApiError(409,"ประเภทงานถูกแก้ไขแล้ว กรุณารีเฟรชรายการ");
      const now=new Date();
      if(value.action==="delete"){
        const result=await dd.collection<Row>("workTypes").updateOne({_id:id,revision:value.revision,deletedAt:null},{$set:{deletedAt:now,updatedAt:now,updatedBy:actor._id},$inc:{revision:1}},{session});
        if(!result.modifiedCount)throw new ApiError(409,"ประเภทงานถูกแก้ไขแล้ว กรุณารีเฟรชรายการ");
      }else{
        const fields={name:value.name,nameKey:workTypeNameKey(value.name),description:value.description,updatedAt:now,updatedBy:actor._id};
        if(old){
          const result=await dd.collection<Row>("workTypes").updateOne({_id:id,revision:value.revision,deletedAt:null},{$set:fields,$inc:{revision:1}},{session});
          if(!result.modifiedCount)throw new ApiError(409,"ประเภทงานถูกแก้ไขแล้ว กรุณารีเฟรชรายการ");
        }else await dd.collection<Row>("workTypes").insertOne({_id:id,companyId:value.companyId,siteId:value.siteId,...fields,revision:0,deletedAt:null,createdAt:now},{session});
      }
      const event=value.action==="delete"?"workType.deleted":old?"workType.updated":"workType.created";
      await dd.collection<Row>("auditLogs").insertOne({_id:randomUUID(),entityId:id,companyId:value.companyId,siteId:value.siteId,entityType:"workTypes",actorId:actor._id,actorName:actor.name,event,reference:value.action==="delete"?old!.name:value.name,ip:auditContext(req).ip,at:now,detail:{note:value.action==="delete"?"นำออกจากตัวเลือกสำหรับใบแจ้งซ่อมใหม่":old?`${old.name} → ${value.name}`:value.name}},{session});
    });
    return NextResponse.json({ok:true});
  }catch(error){return errorResponse(error);}
}
