import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, tx, Row } from "@/lib/db";
import { user, origin, ApiError } from "@/lib/auth";
import { scope } from "@/lib/domain";
import { auditContext } from "@/lib/audit-context";
export const runtime="nodejs";
const kinds=z.enum(["sites","locations"]);
const schema=z.object({kind:kinds,action:z.enum(["save","delete"]),id:z.string().min(1).max(100).optional(),name:z.string().trim().max(200).optional(),companyId:z.string().min(1).max(100).optional(),siteId:z.string().min(1).max(100).optional(),floor:z.string().trim().max(100).default(""),revision:z.number().int().nonnegative().default(0)}).refine(v=>v.action!=="delete"||Boolean(v.id),{message:"กรุณาเลือกข้อมูลที่จะลบ"});
function error(e:unknown){return NextResponse.json({error:e instanceof ApiError?e.message:e instanceof z.ZodError?"กรุณาตรวจสอบข้อมูล":"บันทึกไม่สำเร็จ"},{status:e instanceof ApiError?e.status:e instanceof z.ZodError?400:500});}
export async function GET(req:Request){try{const actor=await user(req);if(actor.role!=="admin")throw new ApiError(403,"เฉพาะ Admin");const kind=kinds.parse(new URL(req.url).searchParams.get("kind"));const d=await db();const filter=scope(actor);return NextResponse.json({items:await d.collection<Row>(kind).find({...filter,deletedAt:null}).sort({name:1}).toArray(),companies:kind==="sites"?await d.collection<Row>("companies").find({_id:{$in:actor.grants.map(g=>g.companyId)},deletedAt:null},{projection:{name:1,nameTh:1}}).sort({name:1}).toArray():[],sites:await d.collection<Row>("sites").find({...scope(actor),deletedAt:null}).sort({name:1}).toArray()});}catch(e){return error(e);}}
export async function POST(req:Request){try{origin(req);const actor=await user(req);if(actor.role!=="admin"||!actor.grants.length)throw new ApiError(403,"เฉพาะ Admin ที่มีขอบเขตสิทธิ์");const v=schema.parse(await req.json());if(v.action==="save"&&!v.name)throw new ApiError(400,"กรุณาระบุชื่อ");const id=v.id||randomUUID();await tx(async(d,s)=>{
// Shared lock also used by user writes, preventing deletion/assignment races.
await d.collection<Row>("systemSettings").updateOne({_id:"admin-users-write-lock"},{$inc:{revision:1}},{upsert:true,session:s});
const filter=scope(actor);
const old=v.id?await d.collection<Row>(v.kind).findOne({_id:id,...filter,deletedAt:null},{session:s}):null;
if(v.id&&!old)throw new ApiError(404,"ไม่พบข้อมูลหรือไม่มีสิทธิ์");if(old&&(old.revision||0)!==v.revision)throw new ApiError(409,"ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรช");
let g=old?{companyId:old.companyId,siteId:old.siteId}:actor.grants[0];
if(v.kind==="sites"){
if(!v.companyId||!actor.grants.some(grant=>grant.companyId===v.companyId))throw new ApiError(403,"กรุณาเลือกบริษัทในขอบเขตสิทธิ์");
const company=await d.collection<Row>("companies").findOne({_id:v.companyId,deletedAt:null},{session:s});
if(!company)throw new ApiError(400,"ไม่พบบริษัทที่เลือก");
if(old&&old.companyId!==v.companyId)throw new ApiError(400,"ไม่สามารถย้ายอาคาร/โรงงานเดิมไปบริษัทอื่นได้");
g={companyId:v.companyId,siteId:id};
}
if(v.kind==="locations"&&v.action==="save"){
const site=await d.collection<Row>("sites").findOne({_id:v.siteId,...scope(actor),deletedAt:null},{session:s});if(!site)throw new ApiError(400,"กรุณาเลือกอาคาร/โรงงาน");
if(old&&old.siteId!==site._id)throw new ApiError(400,"ไม่สามารถย้ายสถานที่ที่มีประวัติ");g={companyId:site.companyId,siteId:site._id};
}
if(v.action==="delete"){
const refs=v.kind==="sites"?["ldapSettings","locations","assets","repairRequests","workOrders","pmPlans","pmTemplates","spareParts","maintenanceTeams"]:["assets","repairRequests","workOrders","pmPlans"];
for(const name of refs){const match=v.kind==="sites"?{siteId:id}:{locationId:id};if(await d.collection(name).findOne(match,{session:s,projection:{_id:1}}))throw new ApiError(409,"มีข้อมูลอ้างอิงอยู่ ไม่สามารถลบได้");}
if(v.kind==="sites"){
if(actor.grants.length<=1)throw new ApiError(409,"ต้องเหลืออาคาร/โรงงานอย่างน้อยหนึ่งแห่งในสิทธิ์ของคุณ");
if(await d.collection<Row>("users").findOne({_id:{$ne:actor._id},grants:{$elemMatch:g}},{session:s}))throw new ApiError(409,"มีผู้ใช้งานอ้างอิงอาคาร/โรงงานนี้");
await d.collection<{_id:string;grants:{companyId:string;siteId:string}[]}>("users").updateOne({_id:actor._id},{$pull:{grants:g}},{session:s});
}
await d.collection<Row>(v.kind).updateOne({_id:id},{$set:{deletedAt:new Date()},$inc:{revision:1}},{session:s});
}else{
await d.collection<Row>(v.kind).updateOne({_id:id},{$set:{...g,name:v.name,...(v.kind==="locations"?{floor:v.floor}:{}),deletedAt:null,updatedAt:new Date()},$inc:{revision:1},$setOnInsert:{createdAt:new Date()}},{upsert:true,session:s});
if(v.kind==="sites"&&!old)await d.collection<Row>("users").updateOne({_id:actor._id},{$addToSet:{grants:g}},{session:s});
}
const auditGrant=v.action==="delete"&&v.kind==="sites"?actor.grants.find(x=>x.siteId!==id)!:g;
await d.collection<Row>("auditLogs").insertOne({_id:randomUUID(),...auditGrant,...auditContext(req),entityId:id,entityType:v.kind,actorId:actor._id,actorName:actor.name,event:`${v.kind}.${v.action}`,reference:v.name||old?.name,at:new Date()},{session:s});
});return NextResponse.json({ok:true,id});}catch(e){return error(e);}}
