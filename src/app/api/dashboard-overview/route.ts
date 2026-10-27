import { workOrderStatusFilter, workOrderListFilter } from "@/lib/work-order-filters";
import { NextResponse } from "next/server";
import { db, Row } from "@/lib/db";
import { user, ApiError } from "@/lib/auth";
import { scope } from "@/lib/domain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const u = await user(req);
    const d = await db();
    const requestScope: Record<string, unknown> = { ...scope(u) };
    const workScope: Record<string, unknown> = { ...scope(u) };
    if (u.role === "requester") {
      requestScope.requesterId = u._id;
      const ids = await d.collection<Row>("repairRequests").find(requestScope, { projection: { _id: 1 } }).toArray();
      workScope.requestId = { $in: ids.map(x => x._id) };
    }
    if (u.role === "technician") {
      workScope.assigneeIds = u._id;
      const ids = await d.collection<Row>("workOrders").find(workScope, { projection: { requestId: 1 } }).toArray();
      requestScope._id = { $in: ids.map(x => x.requestId) };
    }
    const now = new Date();
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(now);
    const y = Number(month.find(x => x.type === "year")!.value);
    const m = Number(month.find(x => x.type === "month")!.value) - 1;
    const start = new Date(Date.UTC(y, m - 5, 1, -7));
    const end = new Date(Date.UTC(y, m + 1, 1, -7));
    const rq = d.collection("repairRequests"), wo = d.collection("workOrders");
    const trend = (field: string) => [{ $match: { [field]: { $gte: start, $lt: end } } }, { $group: { _id: { $dateToString: { date: "$" + field, format: "%Y-%m", timezone: "Asia/Bangkok" } }, count: { $sum: 1 } } }];
    const results = await Promise.all([
      rq.countDocuments(requestScope), rq.countDocuments({ ...requestScope, status: "pending" }),
      wo.countDocuments({ ...workScope, status: workOrderStatusFilter("outstanding") }),
      wo.countDocuments({ ...workScope, ...workOrderListFilter("overdue", now) }),
      wo.countDocuments({ ...workScope, status: "completed" }),
      wo.countDocuments({ ...workScope, status: workOrderStatusFilter("waiting") }),
      wo.countDocuments({ ...workScope, status: "review" }),
      wo.aggregate([{ $match: workScope }, { $group: { _id: null, value: { $sum: "$costSatang" } } }]).toArray(),
      wo.aggregate([{ $match: workScope }, { $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
      rq.aggregate([{ $match: requestScope }, ...trend("createdAt")]).toArray(),
      wo.aggregate([{ $match: { ...workScope, status: "completed" } }, ...trend("completedAt")]).toArray(),
      wo.find({ ...workScope, status: workOrderStatusFilter("outstanding") }, { projection: { number: 1, title: 1, status: 1, dueAt: 1, siteId: 1 } }).sort({ dueAt: 1 }).limit(6).toArray(),
      rq.find(requestScope, { projection: { number: 1, title: 1, status: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(5).toArray(),
    ]);
    const [requests, pending, active, overdue, completed, waiting, review, costs, statuses, created, finished, orders, recent] = results;
    return NextResponse.json({ requests, pending, active, overdue, completed, waiting, review, costSatang: (costs as {value:number}[])[0]?.value || 0, statuses, created, finished, orders, recent, refreshedAt: now }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("Dashboard overview failed", e instanceof Error ? e.name : "unknown");
    return NextResponse.json({ error: "โหลดภาพรวมไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
