import { NextResponse } from "next/server";
import { db, Row } from "@/lib/db";
import { user, ApiError } from "@/lib/auth";
import { scope, labels } from "@/lib/domain";
import { auditActions, auditModules, auditDescription } from "@/lib/audit-display";
import { auditOverviewWindow, buildAuditOverview } from "@/lib/audit-overview";
import { AUDIT_PAGE_SIZE } from "@/lib/audit-pagination";
import { auditDateRange } from "@/lib/audit-query";
import { escapeUserSearch } from "@/lib/admin-users-policy";
import type { Document } from "mongodb";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const dictionary = (field: string, values: Record<string,string>, fallback: unknown = field) => ({ $switch: { branches: Object.entries(values).map(([key,value]) => ({ case: { $eq: [field,key] }, then: value })), default: fallback } });
export async function GET(req: Request) {
  try {
    const actor = await user(req);
    if (actor.role !== "admin") throw new ApiError(403,"ไม่มีสิทธิ์");
    const d = await db(), params = new URL(req.url).searchParams;
    const page = Math.max(1,Math.min(1000000,Number(params.get("page")) || 1));
    const filter: Document = {};
    if (params.get("actor")) filter.actorId = params.get("actor");
    if (params.get("module")) filter.module = params.get("module");
    if (params.get("action")) filter.action = params.get("action");
    const dates = auditDateRange(params.get("from"),params.get("to"));
    if (Object.keys(dates).length) filter.at = dates;
    const joins: Document[] = [ { $match: scope(actor) } ];
    for (const [collection,alias] of [["users","actor"],["repairRequests","request"],["workOrders","order"],["assets","asset"],["locations","location"],["users","target"]]) {
      const isUser = collection === "users";
      const visible = isUser ? { grants: { $elemMatch: { $or: actor.grants.length ? actor.grants : [{siteId:"__none__"}] } } } : scope(actor);
      joins.push({ $lookup: { from: collection, let: { id: alias === "actor" ? "$actorId" : "$entityId" }, pipeline: [{ $match: { $and: [visible,{ $expr: { $eq: ["$_id","$$id"] } }] } },{ $project: { name:1, username:1, number:1, code:1, title:1 } }], as: alias } });
    }
    joins.push({ $set: {
      actorName: { $ifNull: ["$actorName",{ $ifNull: [{ $arrayElemAt: ["$actor.name",0] },"$actorId"] }] },
      reference: { $ifNull: ["$reference",{ $ifNull: [{ $arrayElemAt: ["$request.number",0] },{ $ifNull: [{ $arrayElemAt: ["$order.number",0] },{ $ifNull: [{ $arrayElemAt: ["$asset.code",0] },{ $ifNull: [{ $arrayElemAt: ["$location.name",0] },{ $ifNull: [{ $arrayElemAt: ["$target.username",0] },"$entityId"] }] }] }] }] }] },
      module: { $switch: { branches: [
        { case: { $regexMatch: { input:"$event",regex:"^pm\\." } }, then:"pm" },
        { case: { $in: ["$event",["login","logout"]] }, then:"login" },
        { case: { $regexMatch: { input:"$event",regex:"^user\\." } }, then:"users" },
        { case: { $eq: ["$event","profile"] }, then:"profile" },
        { case: { $regexMatch: { input:"$event",regex:"^request\\." } }, then:"repairRequests" },
        { case: { $regexMatch: { input:"$event",regex:"^workOrder\\.|^log\\." } }, then:"workOrders" },
      ], default: { $ifNull: ["$entityType",{ $ifNull: ["$detail.kind",{ $cond: [{ $gt: [{ $size:"$request" },0] },"repairRequests",{ $cond: [{ $gt: [{ $size:"$order" },0] },"workOrders","other"] }] }] }] } } },
      action: dictionary("$event",auditActions),
    } });
    joins.push({ $set: { searchText: { $concat: ["$action",dictionary("$module",auditModules,"รายการ")," ",{ $ifNull:["$reference",""] }," ",{ $ifNull:["$detail.note",""] }," ",dictionary("$detail.from",labels,"")," ",dictionary("$detail.to",labels,"")," ",dictionary("$detail.next",labels,"")] } } });
    const q = params.get("q")?.trim().slice(0,200);
    if (q) {
      const regex = escapeUserSearch(q);
      filter.$or = ["reference","actorName","ip","event","searchText","detail.note","request.title","order.title"].map(field => ({ [field]: { $regex:regex,$options:"i" } }));
    }
    const refreshedAt=new Date();
    const window=auditOverviewWindow(refreshedAt,params.get("to"));
    const overviewMatch={ $and: [filter,{at:{$gte:window.start,$lt:window.end}}] };
    const result = await d.collection<Row>("auditLogs").aggregate([...joins,{ $facet: {
      items: [{ $match:filter },{ $sort:{ at:-1,_id:-1 } },{ $skip:(Math.floor(page)-1)*AUDIT_PAGE_SIZE },{ $limit:AUDIT_PAGE_SIZE },{ $project: { _id:1,actorId:1,actorName:1,at:1,module:1,action:1,event:1,detail:1,reference:1,entityId:1,ip:1 } }],
      count: [{ $match:filter },{ $count:"total" }],
      overviewDaily: [{ $match:overviewMatch },{ $group: {
        _id:{$dateToString:{format:"%Y-%m-%d",date:"$at",timezone:"Asia/Bangkok"}},
        activities:{$sum:{$cond:[{$in:["$event",["login","logout"]]},0,1]}},
        logins:{$sum:{$cond:[{$eq:["$event","login"]},1,0]}},
        actorIds:{$addToSet:"$actorId"},count:{$sum:1},
      } },{ $project:{activities:1,logins:1,count:1,users:{$size:"$actorIds"}} }],
      overviewModules: [{ $match:overviewMatch },{ $group:{_id:"$module",count:{$sum:1}} },{ $sort:{count:-1,_id:1} },{ $limit:7 }],
      users: [{ $group: { _id:"$actorId",name:{ $first:"$actorName" } } },{ $sort:{ name:1 } }],
      modules: [{ $group: { _id:"$module" } }],
      actions: [{ $group: { _id:"$action" } }],
    } }]).next();
    return NextResponse.json({ items: (result?.items || []).map((row: Row) => ({ ...row, description:auditDescription(row.event,row.module,row.reference || "",row.detail), referenceView:["repairRequests","workOrders","assets"].includes(row.module)?row.module:null })), total:result?.count[0]?.total || 0, users:result?.users || [], modules:result?.modules || [], actions:result?.actions || [], page:Math.floor(page), overview:buildAuditOverview(window.dates,result?.overviewDaily || [],result?.overviewModules || [],refreshedAt) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof ApiError ? e.message : "โหลดประวัติไม่สำเร็จ" },{ status:e instanceof ApiError ? e.status : 500 });
  }
}