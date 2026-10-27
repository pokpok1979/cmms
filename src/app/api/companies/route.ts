import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {z} from "zod";
import {db,tx,Row} from "@/lib/db";
import {user,origin,ApiError} from "@/lib/auth";
import {auditContext} from "@/lib/audit-context";
import {canManageCompany,companyChangeSchema,companyRevisionMatch,companyDeletionBlock} from "@/lib/companies-policy";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function error(e:unknown){return NextResponse.json({error:e instanceof ApiError?e.message:e instanceof z.ZodError?e.issues[0]?.message:(e as {code?:number})?.code===11000?"รหัสบริษัทซ้ำ":"ดำเนินการบริษัทไม่สำเร็จ"},{status:e instanceof ApiError?e.status:e instanceof z.ZodError?400:(e as {code?:number})?.code===11000?409:500});}
export async function GET(req:Request){try{
const actor=await user(req);if(actor.role!=="admin")throw new ApiError(403,"เฉพาะ Admin");const d=await db();const ids=[...new Set(actor.grants.map(g=>g.companyId))];
const [companies,sites]=await Promise.all([d.collection<Row>("companies").find({_id:{$in:ids},deletedAt:null}).sort({name:1}).toArray(),d.collection<Row>("sites").find({companyId:{$in:ids}}).toArray()]);
const q=new URL(req.url).searchParams.get("q")?.trim().toLowerCase()||"";
const items=companies.map(c=>({_id:c._id,nameTh:c.nameTh||c.name||"",nameEn:c.nameEn||"",phone:c.phone||"",email:c.email||"",website:c.website||"",address:c.address||"",revision:c.revision||0,siteCount:sites.filter(s=>s.companyId===c._id&&!s.deletedAt).length,canManage:canManageCompany(actor,c._id,sites.filter(s=>s.companyId===c._id).map(s=>({siteId:s.siteId||s._id})))})).filter(c=>!q||[c._id,c.nameTh,c.nameEn,c.phone,c.email].join(" ").toLowerCase().includes(q));return NextResponse.json({items,total:items.length});
}catch(e){return error(e);}}
export async function POST(req:Request){try{
origin(req);const actor=await user(req);if(actor.role!=="admin"||!actor.grants.length)throw new ApiError(403,"เฉพาะ Admin ที่มีขอบเขตสิทธิ์");const v=companyChangeSchema.parse(await req.json());const id=v.id||(v.action==="save"?v.code:"");
await tx(async(d,s)=>{
await d.collection<Row>("systemSettings").updateOne({_id:"admin-users-write-lock"},{$inc:{revision:1}},{upsert:true,session:s});
const old=await d.collection<Row>("companies").findOne({_id:id},{session:s});const sites=await d.collection<Row>("sites").find({companyId:id},{session:s}).toArray();
if(v.id){if(!old||old.deletedAt)throw new ApiError(404,"ไม่พบบริษัท");if(!canManageCompany(actor,id,sites.map(x=>({siteId:x.siteId||x._id}))))throw new ApiError(403,"ต้องมีสิทธิ์ครบทุกโรงงาน / สาขาของบริษัท");if((old.revision||0)!==v.revision)throw new ApiError(409,"ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรช");}else if(old||sites.length)throw new ApiError(409,"รหัสบริษัทมีอยู่แล้ว");
const now=new Date();let g=actor.grants.find(x=>x.companyId===id)||actor.grants[0];
if(v.action==="delete"){
if(companyDeletionBlock(actor,id,false))throw new ApiError(409,"ต้องเหลือบริษัทอย่างน้อยหนึ่งแห่งในสิทธิ์ของคุณ");
for(const name of ["ldapSettings","smtpSettings","locations","assets","repairRequests","workOrders","workLogs","attachments","comments","notifications","maintenanceTeams","workTypes","pmTemplates","pmPlans","pmOccurrences","pmResults","spareParts","sparePartTransactions","assetMeterReadings","downtimeEvents"]){if(await d.collection(name).findOne({companyId:id},{session:s,projection:{_id:1}}))throw new ApiError(409,"มีข้อมูลอ้างอิงบริษัท ไม่สามารถลบได้");}
if(await d.collection<Row>("users").findOne({_id:{$ne:actor._id},"grants.companyId":id},{session:s,projection:{_id:1}}))throw new ApiError(409,"มีผู้ใช้งานอ้างอิงบริษัท");
await d.collection<Row>("companies").updateOne({_id:id,...companyRevisionMatch(old!.revision)},{$set:{deletedAt:now,updatedAt:now},$inc:{revision:1}},{session:s});
await d.collection<Row>("sites").updateMany({companyId:id},{$set:{deletedAt:now,updatedAt:now},$inc:{revision:1}},{session:s});
await d.collection<{_id:string;grants:{companyId:string;siteId:string}[]}>("users").updateOne({_id:actor._id},{$pull:{grants:{companyId:id}}},{session:s});g=actor.grants.find(x=>x.companyId!==id)!;
}else{
if(old&&v.code!==id.toUpperCase())throw new ApiError(400,"ไม่สามารถเปลี่ยนรหัสบริษัทเดิม");const fields={name:v.nameTh,nameTh:v.nameTh,nameEn:v.nameEn,phone:v.phone,email:v.email,website:v.website,address:v.address,updatedAt:now,updatedBy:actor._id};
if(old){await d.collection<Row>("companies").updateOne({_id:id,...companyRevisionMatch(old.revision)},{$set:fields,$inc:{revision:1}},{session:s});await d.collection<Row>("systemSettings").updateMany({companyId:id,companyNameTh:{$exists:true}},{$set:{companyNameTh:v.nameTh,companyNameEn:v.nameEn,phone:v.phone,email:v.email,website:v.website,address:v.address,updatedAt:now},$inc:{revision:1}},{session:s});}
else{g={companyId:id,siteId:randomUUID()};await d.collection<Row>("companies").insertOne({_id:id,...fields,deletedAt:null,revision:0,createdAt:now},{session:s});await d.collection<Row>("sites").insertOne({_id:g.siteId,...g,name:v.firstSiteName,deletedAt:null,revision:0,createdAt:now},{session:s});await d.collection<Row>("users").updateOne({_id:actor._id},{$addToSet:{grants:g}},{session:s});}
}
await d.collection<Row>("auditLogs").insertOne({_id:randomUUID(),...g,...auditContext(req),entityId:id,entityType:"companies",actorId:actor._id,actorName:actor.name,event:v.action==="delete"?"company.deleted":old?"company.updated":"company.created",reference:v.action==="save"?v.nameTh:old!.nameTh||old!.name,at:now},{session:s});
});return NextResponse.json({ok:true,id});
}catch(e){return error(e);}}
