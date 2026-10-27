import { workOrderListFilter } from "@/lib/work-order-filters";
import { NextResponse } from "next/server";
import { assetReferenceCollections, assetScopeChange } from "@/lib/assets-policy";
import { readWorkTypes } from "@/lib/work-types";
import { resolveWorkType } from "@/lib/work-types-policy";
import { settingsId, workOrderDeadline } from "@/lib/system-settings-policy";
import { auditContext } from "@/lib/audit-context";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, tx, number, Row } from "@/lib/db";
import {
  user,
  login,
  logout,
  origin,
  ApiError,
  hashPassword,
  verify,
  digest,
} from "@/lib/auth";
import { labels, scope, manager, inScope, canTransition, User } from "@/lib/domain";
import { permitted } from "@/lib/permissions";
import { notifyRequestCreated } from "@/lib/request-notifications";
import { canReceiveNotification } from "@/lib/notification-policy";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const text = z.string().trim().min(1).max(2000),
  id = z.string().min(1).max(100);
const grant = z.object({ companyId: id, siteId: id });
function fail(status: number, message: string): never {
  throw new ApiError(status, message);
}
function check(u: User, r: Row | null): asserts r is Row {
  if (!r || !inScope(u, { companyId: r.companyId, siteId: r.siteId }))
    fail(404, "ไม่พบข้อมูล");
}
async function visible(u: User, kind: string, recordId: string) {
  if (!permitted(u, kind)) fail(403, "ไม่มีสิทธิ์ดูข้อมูลตามบทบาท & สิทธิ์");
  const d = await db();
  const r = await d
    .collection<Row>(kind)
    .findOne({ _id: recordId, ...scope(u) });
  check(u, r);
  if (
    kind === "repairRequests" &&
    u.role === "requester" &&
    r.requesterId !== u._id
  )
    fail(404, "ไม่พบข้อมูล");
  if (
    kind === "workOrders" &&
    u.role === "technician" &&
    !r.assigneeIds.includes(u._id)
  )
    fail(404, "ไม่พบข้อมูล");
  if (kind === "workOrders" && u.role === "requester") {
    const rr = await d
      .collection<Row>("repairRequests")
      .findOne({ _id: r.requestId, requesterId: u._id });
    if (!rr) fail(404, "ไม่พบข้อมูล");
  }
  if (kind === "repairRequests" && u.role === "technician") {
    const wo = await d
      .collection<Row>("workOrders")
      .findOne({ requestId: r._id, assigneeIds: u._id, ...scope(u) });
    if (!wo) fail(404, "ไม่พบข้อมูล");
  }
  return r;
}
function r2() {
  if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET)
    fail(503, "ยังไม่ได้ตั้งค่าที่เก็บไฟล์");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });
}
async function audit(
  req: Request,
  d: Awaited<ReturnType<typeof db>>,
  s: import("mongodb").ClientSession,
  u: User,
  r: Row,
  event: string,
  detail: unknown,
) {
  await d.collection<Row>("auditLogs").insertOne(
    {
      _id: randomUUID(),
      entityId: r._id,
      companyId: r.companyId,
      siteId: r.siteId,
      actorId: u._id,
      actorName: u.name,
      reference: r.number || r.code || undefined,
      ...auditContext(req),
      entityType: event === "attachment.added" ? (detail as { kind?: string })?.kind : auditContext(req).entityType,
      event,
      detail,
      at: new Date(),
    },
    { session: s },
  );
}
async function notification(
  d: Awaited<ReturnType<typeof db>>,
  s: import("mongodb").ClientSession,
  r: Row,
  recipientId: string,
  message: string,
  actor: User,
  target?: { module: string; entityId: string },
) {
  await d.collection<Row>("notifications").insertOne(
    {
      _id: randomUUID(),
      recipientId,
      companyId: r.companyId,
      siteId: r.siteId,
      message,
      actorId: actor._id,
      actorName: actor.name,
      ...target,
      at: new Date(),
      read: false,
    },
    { session: s },
  );
}
async function handle(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const path = (await ctx.params).path,
    [kind, recordId, action] = path,
    d = await db();
  if (req.method !== "GET") origin(req);
  /*
  if (kind === "login" && req.method === "POST") {
    const v = z
      .object({ username: text, password: z.string().min(1).max(200) })
      .parse(await req.json());
    await login(v.username, v.password);
    return { ok: true };
  }
  */
  if (kind === "login" && req.method === "POST") {
    const v = z
      .object({
        username: text,
        password: z.string().min(1).max(200),
      })
      .parse(await req.json());

    const loggedIn = await login(v.username, v.password);
    const grant = loggedIn.grants[0];
    if (grant) await d.collection<Row>("auditLogs").insertOne({
      _id:randomUUID(),entityId:loggedIn._id,actorId:loggedIn._id,actorName:loggedIn.name,
      reference:loggedIn.username,...grant,...auditContext(req),event:"login",at:new Date(),
    });
    return { ok: true };
  }
  if (kind === "logout" && req.method === "POST") {
    // Expired sessions and audit failures must not prevent clearing the cookie.
    let actor: Awaited<ReturnType<typeof user>> | undefined;
    try { actor = await user(); } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    await logout();
    const grant = actor?.grants[0];
    if (actor && grant) {
      try {
        await d.collection<Row>("auditLogs").insertOne({
          _id:randomUUID(),entityId:actor._id,actorId:actor._id,actorName:actor.name,
          reference:actor.username,...grant,...auditContext(req),event:"logout",at:new Date(),
        });
      } catch { console.error("Logout audit could not be recorded"); }
    }
    return { ok: true };
  }
  const u = await user(req);
  if (kind === "me") return u;
  if (kind === "profile" && req.method === "POST") {
    const v = z
      .object({
        name: text,
        currentPassword: z.string().max(200),
        newPassword: z.string().min(12).max(200).optional(),
      })
      .parse(await req.json());
    const old = await d.collection<Row>("users").findOne({ _id: u._id });
    if (!verify(v.currentPassword, old!.passwordHash))
      fail(400, "รหัสผ่านปัจจุบันไม่ถูกต้อง");
    await tx(async (dd, s) => {
      await dd.collection<Row>("users").updateOne(
        { _id: u._id },
        {
          $set: {
            name: v.name,
            ...(v.newPassword
              ? { passwordHash: hashPassword(v.newPassword) }
              : {}),
          },
        },
        { session: s },
      );
      await audit(req,
        dd,
        s,
        u,
        {
          _id: u._id,
          companyId: u.grants[0]?.companyId,
          siteId: u.grants[0]?.siteId,
        },
        "profile",
        {},
      );
      if (v.newPassword)
        await dd
          .collection<Row>("sessions")
          .deleteMany({ userId: u._id }, { session: s });
    });
    return { ok: true };
  }
  if (kind === "lookups") {
    return {
      companies: await d.collection<Row>("companies")
        .find({ _id: { $in: [...new Set(u.grants.map(g => g.companyId))] }, deletedAt: null })
        .project({ _id: 1, name: 1, nameTh: 1, code: 1 })
        .toArray(),
      workTypes: await readWorkTypes(d,u),
      sites: await d
        .collection<Row>("sites")
        .find({ ...scope(u), deletedAt: null })
        .toArray(),
      locations: await d
        .collection<Row>("locations")
        .find({ ...scope(u), deletedAt: null })
        .toArray(),
      assets: await d
        .collection<Row>("assets")
        .find({ ...scope(u), deletedAt: null })
        .toArray(),
      technicians: manager(u)
        ? await d
            .collection<Row>("users")
            .find(
              {
                role: "technician",
                active: true,
                grants: { $elemMatch: { $or: u.grants } },
              },
              { projection: { passwordHash: 0 } },
            )
            .toArray()
        : [],
    };
  }
  if (kind === "dashboard") {
    const rq = await requestFilter(u),
      wo = await workFilter(u);
    return {
      requests: await d.collection("repairRequests").countDocuments(rq),
      pending: await d
        .collection("repairRequests")
        .countDocuments({ ...rq, status: "pending" }),
      active: await d.collection("workOrders").countDocuments({
        ...wo,
        status: { $nin: ["completed", "cancelled"] },
      }),
      overdue: await d.collection("workOrders").countDocuments({
        ...wo,
        dueAt: { $lt: new Date() },
        status: { $nin: ["completed", "cancelled"] },
      }),
    };
  }
  if (kind === "notifications" && req.method === "GET")
    return await d
      .collection<Row>("notifications")
      .find({ recipientId: u._id, ...scope(u) })
      .sort({ at: -1 })
      .limit(100)
      .toArray();
  if (kind === "auditLogs" && req.method === "GET") {
    if (u.role !== "admin") fail(403, "ไม่มีสิทธิ์");
    return await d
      .collection<Row>("auditLogs")
      .find(scope(u))
      .sort({ at: -1 })
      .limit(100)
      .toArray();
  }
  if (kind === "users") {
    if (u.role !== "admin") fail(403, "ไม่มีสิทธิ์");
    if (req.method === "GET")
      return await d
        .collection<Row>("users")
        .find(
          { grants: { $elemMatch: { $or: u.grants } } },
          { projection: { passwordHash: 0 } },
        )
        .toArray();
    fail(410,"Use /api/admin-users to manage users");
  }
  if (["sites", "locations", "assets"].includes(kind)) {
    if (req.method === "GET") {
      if (recordId) {
        const r = await d
          .collection<Row>(kind)
          .findOne({ _id: recordId, ...scope(u), deletedAt: null });
        check(u, r);
        if (kind === "assets")
          return {
            ...r,
            requests: await d
              .collection<Row>("repairRequests")
              .find({ ...(await requestFilter(u)), assetId: r._id })
              .toArray(),
            orders: await d
              .collection<Row>("workOrders")
              .find({ ...(await workFilter(u)), assetId: r._id })
              .toArray(),
          };
        return r;
      }
      return await d
        .collection<Row>(kind)
        .find({ ...scope(u), deletedAt: null })
        .toArray();
    }
    if (kind !== "assets") fail(403,"Use /api/masters");
    if (!manager(u)) fail(403, "ไม่มีสิทธิ์");
    if (action === "delete" && recordId) {
      await tx(async (dd, s) => {
        const existing = await dd.collection<Row>("assets").findOne(
          { _id: recordId, ...scope(u), deletedAt: null }, { session: s },
        );
        check(u, existing);
        for (const collection of ["repairRequests", "workOrders", "pmPlans", "pmOccurrences", "pmResults", "assetMeterReadings", "downtimeEvents"]) {
          if (await dd.collection<Row>(collection).findOne({ assetId: recordId }, { session: s, projection: { _id: 1 } }))
            fail(409, "เครื่องจักรมีข้อมูลอ้างอิง ไม่สามารถลบได้ กรุณาเปลี่ยนสถานะเป็นเลิกใช้งาน");
        }
        await dd.collection<Row>("assets").updateOne(
          { _id: recordId, ...scope(u), deletedAt: null },
          { $set: { deletedAt: new Date() } }, { session: s },
        );
        await audit(req, dd, s, u, existing, "master.deleted", { kind });
      });
      return { ok: true };
    }
    if (action) fail(404, "ไม่พบการดำเนินการ");
    const v = z
      .object({
        companyId: id,
        siteId: id,
        name: text,
        code: id.optional(),
        locationId: id.optional(),
        brand: z.string().max(100).optional(),
        model: z.string().max(100).optional(),
        serialNumber: z.string().max(100).optional(),
        status: z
          .enum(["active", "repair", "standby", "retired"])
          .default("active"),
      })
      .parse(await req.json());
    if (!inScope(u, v)) fail(403, "ไม่มีสิทธิ์");
    if (v.locationId) {
      const loc = await d.collection<Row>("locations").findOne({
        _id: v.locationId,
        companyId: v.companyId,
        siteId: v.siteId,
        deletedAt: null,
      });
      if (!loc) fail(400, "สถานที่ไม่ถูกต้อง");
    }
    const rid = recordId || randomUUID();
    await tx(async (dd, s) => {
      if (recordId) {
        const existing = await dd.collection<Row>(kind).findOne(
          { _id: rid, ...scope(u), deletedAt: null }, { session: s },
        );
        check(u, existing);
        let referenced = false;
        if (existing.companyId !== v.companyId || existing.siteId !== v.siteId) {
          for (const collection of assetReferenceCollections) {
            if (await dd.collection<Row>(collection).findOne({assetId:rid},{session:s,projection:{_id:1}})) { referenced=true; break; }
          }
        }
        const blocked=assetScopeChange(u,{companyId:existing.companyId,siteId:existing.siteId},v,referenced);
        if(blocked==='forbidden')fail(403,'ไม่มีสิทธิ์ย้ายเครื่องจักรไปบริษัทหรือสาขานี้');
        if(blocked==='has-history')fail(409,'เครื่องจักรมีประวัติซ่อมหรือ PM แล้ว ไม่สามารถย้ายบริษัทหรือสาขาได้');
      }
      const targetSite=await dd.collection<Row>('sites').findOne({_id:v.siteId,companyId:v.companyId,deletedAt:null},{session:s});
      if(!targetSite)fail(400,'ไม่พบสาขาในบริษัทที่เลือก');
      if(v.locationId&&!await dd.collection<Row>('locations').findOne({_id:v.locationId,companyId:v.companyId,siteId:v.siteId,deletedAt:null},{session:s}))fail(400,'สถานที่ไม่ตรงกับบริษัทและสาขาที่เลือก');
      await dd.collection<Row>(kind).updateOne(
        recordId ? { _id: rid, ...scope(u), deletedAt: null } : { _id: rid },
        {
          $set: {
            ...v,

            deletedAt: null,
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: !recordId, session: s },
      );
      await audit(req, dd, s, u, { _id: rid, ...v }, "master.saved", { kind });
    });
    return { ok: true };
  }
  if (["repairRequests", "workOrders"].includes(kind)) {
    if (req.method === "GET") {
      if (recordId) {
        const r = await visible(u, kind, recordId);
        const requester = kind === "repairRequests" && !r.requesterName
          ? await d.collection<Row>("users").findOne(
              { _id: r.requesterId },
              { projection: { name: 1 } },
            )
          : null;
        return {
          ...r,
          ...(kind === "repairRequests" ? { requesterName: r.requesterName || requester?.name || "" } : {}),
          orders:
            kind === "repairRequests"
              ? await d
                  .collection<Row>("workOrders")
                  .find({ requestId: r._id, ...scope(u) })
                  .toArray()
              : [],
          logs:
            kind === "workOrders"
              ? await d
                  .collection<Row>("workLogs")
                  .find({ workOrderId: r._id, ...scope(u) })
                  .toArray()
              : [],
          history: await d
            .collection<Row>("auditLogs")
            .find({ entityId: r._id, ...scope(u) })
            .sort({ at: 1 })
            .toArray(),
          comments: await d
            .collection<Row>("comments")
            .find({ parentId: r._id, ...scope(u) })
            .sort({ at: 1 })
            .toArray(),
          requestAttachments: kind === "workOrders" && r.requestId
            ? await d.collection<Row>("attachments")
                .find({ parentKind: "repairRequests", parentId: r.requestId, ...scope(u), type: { $in: ["image/jpeg", "image/png"] } }, { projection: { key: 0 } })
                .sort({ at: 1, _id: 1 })
                .limit(5)
                .toArray()
            : [],
          attachments: await d
            .collection<Row>("attachments")
            .find({ parentId: r._id, ...scope(u) }, { projection: { key: 0 } })
            .toArray(),
        };
      }
      const url = new URL(req.url),
        page = Math.max(
          1,
          Math.min(10000, Number(url.searchParams.get("page")) || 1),
        ),
        q = (url.searchParams.get("q") || "").slice(0, 100);
      const filter =
        kind === "repairRequests"
          ? await requestFilter(u)
          : await workFilter(u);
      const status = url.searchParams.get("status");
      if (kind === "workOrders") Object.assign(filter, workOrderListFilter(status || ""));
      else if (status) filter.status = status;
      if (q)
        filter.title = {
          $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i",
        };
      return {
        items: await d
          .collection<Row>(kind)
          .find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * 20)
          .limit(20)
          .toArray(),
        total: await d.collection(kind).countDocuments(filter),
        page,
      };
    }
    if (kind === "repairRequests" && !recordId) {
      if (u.role === "executive") fail(403, "ไม่มีสิทธิ์");
      const v = z
        .object({
          companyId: id,
          siteId: id,
          locationId: id,
          assetId: id.optional(),
          type: z.enum(["building", "factory"]),
          category: text.optional(),
          workTypeId: z.string().min(1).max(2000).optional(),
          title: text,
          description: text,
          priority: z.enum(["urgent", "high", "normal"]),
          contact: text,
          impact: text,
          stopped: z.boolean(),
          discoveredAt: z.iso.datetime(),
          idempotencyKey: z.uuid(),
        })
        .refine(value=>Boolean(value.workTypeId || value.category),{message:"กรุณาเลือกประเภทงาน",path:["workTypeId"]})
        .parse(await req.json());
      if (!inScope(u, v)) fail(403, "ไม่มีสิทธิ์");
      const loc = await d.collection<Row>("locations").findOne({
        _id: v.locationId,
        companyId: v.companyId,
        siteId: v.siteId,
        deletedAt: null,
      });
      if (!loc) fail(400, "สถานที่ไม่ถูกต้อง");
      if (
        v.assetId &&
        !(await d.collection<Row>("assets").findOne({
          _id: v.assetId,
          companyId: v.companyId,
          siteId: v.siteId,
          locationId: v.locationId,
          deletedAt: null,
        }))
      )
        fail(400, "เครื่องจักรไม่ตรงกับสถานที่");
      const result = await tx(async (dd, s) => {
        const old = await dd
          .collection<Row>(kind)
          .findOne(
            { requesterId: u._id, idempotencyKey: v.idempotencyKey },
            { session: s },
          );
        if (old) return old;
        const workType=resolveWorkType(await readWorkTypes(dd,{grants:[{companyId:v.companyId,siteId:v.siteId}]},s),v);
        if(!workType)fail(400,"ประเภทงานถูกลบหรือไม่อยู่ในโรงงานนี้ กรุณาโหลดฟอร์มใหม่");
        const r = {
          ...v,
          workTypeId:workType._id,
          category:workType.name,
          _id: randomUUID(),
          number: await number(dd, s, v.siteId, "RR"),
          requesterId: u._id,
          requesterName: u.name,
          department: u.department || "",
          position: u.position || "",
          status: "pending",
          revision: 0,
          createdAt: new Date(),
          discoveredAt: new Date(v.discoveredAt),
        };
        await dd.collection<Row>(kind).insertOne(r, { session: s });
        await audit(req, dd, s, u, r, "request.created", {});
        await notifyRequestCreated(dd, s, r);
        return r;
      });
      return result;
    }
    const r = await visible(u, kind, recordId);
    const body = await req.json();
    if (action === "comments") {
      const v = z.object({ message: text }).parse(body);
      if (u.role === "executive") fail(403, "ไม่มีสิทธิ์");
      await tx(async (dd, s) => {
        await dd.collection<Row>("comments").insertOne(
          {
            _id: randomUUID(),
            parentId: r._id,
            authorId: u._id,
            authorName: u.name,
            companyId: r.companyId,
            siteId: r.siteId,
            message: v.message,
            at: new Date(),
          },
          { session: s },
        );
        await audit(req, dd, s, u, r, "comment.added", { note: v.message });
      });
      return { ok: true };
    }
    if (action === "logs") {
      if (
        kind !== "workOrders" ||
        u.role !== "technician" ||
        !r.assigneeIds.includes(u._id) ||
        !["in_progress", "waiting_parts", "waiting_contractor"].includes(
          r.status,
        )
      )
        fail(403, "บันทึกงานไม่ได้");
      const v = z
        .object({
          cause: text,
          remedy: text,
          testResult: text,
          start: z.iso.datetime(),
          end: z.iso.datetime(),
          costSatang: z.number().int().min(0).max(100000000),
          idempotencyKey: z.uuid(),
        })
        .parse(body);
      if (new Date(v.end) <= new Date(v.start))
        fail(400, "เวลาสิ้นสุดต้องหลังเวลาเริ่ม");
      await tx(async (dd, s) => {
        const previous = await dd
          .collection<Row>("workLogs")
          .findOne(
            { workOrderId: r._id, idempotencyKey: v.idempotencyKey },
            { session: s },
          );
        if (previous) return;
        const lock = await dd
          .collection<Row>(kind)
          .updateOne(
            { _id: r._id, revision: r.revision, status: r.status },
            { $inc: { revision: 1, costSatang: v.costSatang } },
            { session: s },
          );
        if (!lock.modifiedCount) fail(409, "ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่");
        await dd.collection<Row>("workLogs").insertOne(
          {
            ...v,
            _id: randomUUID(),
            companyId: r.companyId,
            siteId: r.siteId,
            workOrderId: r._id,
            technicianId: u._id,
            start: new Date(v.start),
            end: new Date(v.end),
            minutes: (Date.parse(v.end) - Date.parse(v.start)) / 60000,
            at: new Date(),
          },
          { session: s },
        );
        await audit(req, dd, s, u, r, "log.added", { costSatang: v.costSatang });
      });
      return { ok: true };
    }
    if (action === "transition") {
      const v = z
        .object({
          next: id,
          note: z.string().max(2000).default(""),
          assigneeIds: z.array(id).max(20).optional(),
          dueAt: z.iso.datetime().optional(),
          rating: z.number().int().min(1).max(5).optional(),
        })
        .parse(body);
      if (r.status === "review" && v.next === "in_progress" && !permitted(u, kind, "approve"))
        fail(403, "ไม่มีสิทธิ์ตรวจรับตามบทบาท & สิทธิ์");
      if (
        ["rejected", "cancelled"].includes(v.next) ||
        (r.status === "review" && v.next === "in_progress")
      )
        if (!v.note.trim()) fail(400, "กรุณาระบุเหตุผล");
      await tx(async (dd, s) => {
        let set: Record<string, unknown> = {
          status: v.next,
          updatedAt: new Date(),
        };
        if (kind === "repairRequests") {
          if (v.next === "approved" && r.status === "pending" && manager(u)) {
            const configuration=await dd.collection<Row>("systemSettings").findOne(
              {_id:settingsId(r.companyId,r.siteId),companyId:r.companyId,siteId:r.siteId},
              {session:s},
            );
            const due=workOrderDeadline(r.priority,configuration,new Date());
            const wo = {
              _id: randomUUID(),
              number: await number(dd, s, r.siteId, "WO"),
              requestId: r._id,
              ...(r.workTypeId?{workTypeId:r.workTypeId}:{}),
              category:r.category,
              type:r.type,
              companyId: r.companyId,
              siteId: r.siteId,
              locationId: r.locationId,
              assetId: r.assetId,
              title: r.title,
              status: "unassigned",
              assigneeIds: [],
              revision: 0,
              costSatang: 0,
              dueAt: due,
              createdAt: new Date(),
            };
            await dd
              .collection<Row>("workOrders")
              .insertOne(wo, { session: s });
            await audit(req, dd, s, u, wo, "workOrder.created", {});
          } else if (
            v.next === "rejected" &&
            r.status === "pending" &&
            manager(u)
          ) {
          } else if (
            v.next === "cancelled" &&
            r.status === "pending" &&
            (manager(u) || r.requesterId === u._id)
          ) {
          } else if (
            v.next === "closed" &&
            r.status === "awaiting_acceptance" &&
            r.requesterId === u._id
          ) {
            const orders = await dd
              .collection<Row>("workOrders")
              .find({ requestId: r._id }, { session: s })
              .toArray();
            if (!orders.length || orders.some((o) => o.status !== "completed"))
              fail(400, "ใบงานยังไม่เสร็จครบ");
            if (!v.rating) fail(400, "กรุณาประเมินผล");
            set.rating = v.rating;
          } else fail(403, "เปลี่ยนสถานะไม่ได้");
        } else {
          if (
            !canTransition(
              u,
              { status: r.status, assigneeIds: r.assigneeIds },
              v.next,
            )
          )
            fail(403, "เปลี่ยนสถานะไม่ได้");
          if (v.next === "assigned") {
            if (!v.assigneeIds?.length) fail(400, "กรุณาเลือกช่าง");
            const people = await dd
              .collection<Row>("users")
              .find(
                {
                  _id: { $in: v.assigneeIds },
                  active: true,
                  role: "technician",
                  grants: {
                    $elemMatch: { companyId: r.companyId, siteId: r.siteId },
                  },
                },
                { session: s },
              )
              .toArray();
            if (people.length !== new Set(v.assigneeIds).size)
              fail(400, "ช่างไม่มีสิทธิ์ในโรงงานนี้");
            set.assigneeIds = v.assigneeIds;
            if (v.dueAt) set.dueAt = new Date(v.dueAt);
            for (const person of people)
              await notification(
                dd,
                s,
                r,
                person._id,
                `ได้รับมอบหมาย ${r.number}`,
                u,
              );
          }
          if (
            v.next === "review" &&
            !(await dd
              .collection<Row>("workLogs")
              .findOne({ workOrderId: r._id }, { session: s }))
          )
            fail(400, "กรุณาบันทึกผลซ่อมก่อนส่งตรวจ");
          if (v.next === "completed") set.completedAt = new Date();
          if (v.next === "review") {
            const target = { module: "workOrders", entityId: r._id };
            const reviewers = await dd.collection<Row>("users").find({
              active: true,
              role: { $in: ["supervisor", "admin"] },
              grants: { $elemMatch: { companyId: r.companyId, siteId: r.siteId } },
            }, { session: s }).toArray();
            for (const reviewer of reviewers) {
              const recipient = reviewer as User;
              if (!canReceiveNotification(recipient, { ...target, companyId: r.companyId, siteId: r.siteId }) || !permitted(recipient, "workOrders", "approve")) continue;
              await notification(dd, s, r, reviewer._id,
                `ใบงาน ${r.number}: ช่างส่งตรวจรับแล้ว`, u, target);
            }
          }
          if (r.status === "review" && v.next === "in_progress") {
            const target = { module: "workOrders", entityId: r._id };
            const technicians = await dd.collection<Row>("users").find({
              _id: { $in: [...new Set<string>(r.assigneeIds || [])] },
              active: true,
              role: "technician",
              grants: { $elemMatch: { companyId: r.companyId, siteId: r.siteId } },
            }, { session: s }).toArray();
            for (const technician of technicians) {
              if (!canReceiveNotification(technician as User, { ...target, companyId: r.companyId, siteId: r.siteId, assigneeIds: r.assigneeIds })) continue;
              await notification(dd, s, r, technician._id,
                `ใบงาน ${r.number}: ส่งกลับแก้ไข — ${v.note.trim()}`, u, target);
            }
          }
          const rr = await dd
            .collection<Row>("repairRequests")
            .findOne({ _id: r.requestId }, { session: s });
          if (rr) {
            const rrStatus =
              v.next === "cancelled"
                ? "cancelled"
                : v.next === "completed"
                  ? "awaiting_acceptance"
                  : v.next === "review"
                    ? "review"
                    : [
                          "accepted",
                          "in_progress",
                          "waiting_parts",
                          "waiting_contractor",
                        ].includes(v.next)
                      ? "in_progress"
                      : null;
            if (rrStatus) {
              await dd
                .collection<Row>("repairRequests")
                .updateOne(
                  { _id: rr._id },
                  { $set: { status: rrStatus }, $inc: { revision: 1 } },
                  { session: s },
                );
              await audit(req, dd, s, u, rr, "request.progress", { next: rrStatus });
            }
            await notification(
              dd,
              s,
              rr,
              rr.requesterId,
              v.next === "review"
                ? `ใบงาน ${r.number}: ช่างส่งตรวจรับแล้ว รอหัวหน้าตรวจรับ`
                : `${r.number} เปลี่ยนสถานะเป็น ${labels[v.next] || v.next}`,
              u,
              v.next === "review" ? { module: "workOrders", entityId: r._id } : undefined,
            );
          }
        }
        const updated = await dd
          .collection<Row>(kind)
          .updateOne(
            { _id: r._id, revision: r.revision, status: r.status },
            { $set: set, $inc: { revision: 1 } },
            { session: s },
          );
        if (!updated.modifiedCount)
          fail(409, "ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่");
        await audit(req, dd, s, u, r, "status.changed", {
          from: r.status,
          to: v.next,
          note: v.note,
        });
      });
      return { ok: true };
    }
    fail(404, "ไม่พบคำสั่ง");
  }
  if (kind === "attachments") {
    if (req.method === "GET") {
      const a = await d
        .collection<Row>("attachments")
        .findOne({ _id: recordId, ...scope(u) });
      check(u, a);
      await visible(u, a.parentKind, a.parentId);
      return {
        url: await getSignedUrl(
          r2(),
          new GetObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: a.key,
            ResponseContentDisposition: new URL(req.url).searchParams.get("preview") === "1" && ["image/jpeg", "image/png"].includes(a.type) ? "inline" : "attachment",
          }),
          { expiresIn: 60 },
        ),
      };
    }
    const form = await req.formData(),
      parentKind = String(form.get("parentKind")),
      parentId = String(form.get("parentId"));
    if (!["repairRequests", "workOrders"].includes(parentKind))
      fail(400, "เอกสารไม่ถูกต้อง");
    const parent = await visible(u, parentKind, parentId);
    if (!permitted(u, parentKind, "edit")) fail(403, "ไม่มีสิทธิ์แนบไฟล์ตามบทบาท & สิทธิ์");
    if (
      u.role === "executive" ||
      ["closed", "completed", "cancelled", "rejected"].includes(parent.status)
    )
      fail(403, "แนบไฟล์ไม่ได้");
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 8 * 1024 * 1024 || !file.size)
      fail(400, "ไฟล์ต้องไม่เกิน 8 MB");
    const b = Buffer.from(await file.arrayBuffer());
    const detected = b.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      ? "image/jpeg"
      : b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : b.subarray(0, 5).toString() === "%PDF-"
          ? "application/pdf"
          : null;
    if (!detected || detected !== file.type)
      fail(400, "รองรับ JPG PNG PDF ที่ถูกต้องเท่านั้น");
    const rid = randomUUID(),
      key = `${parent.companyId}/${parent.siteId}/${parentId}/${rid}`;
    await r2().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: b,
        ContentType: detected,
        Metadata: { parent: parentId },
      }),
    );
    await tx(async (dd, s) => {
      await dd.collection<Row>("attachments").insertOne(
        {
          _id: rid,
          key,
          parentKind,
          parentId,
          companyId: parent.companyId,
          siteId: parent.siteId,
          name: file.name.slice(0, 150),
          size: file.size,
          type: detected,
          uploadedBy: u._id,
          at: new Date(),
        },
        { session: s },
      );
      await audit(req, dd, s, u, parent, "attachment.added", { id: rid, kind: parentKind, note: file.name.slice(0,150) });
    });
    return { ok: true };
  }
  fail(404, "ไม่พบข้อมูล");
}
async function requestFilter(u: User): Promise<Record<string, any>> {
  const f: Record<string, any> = scope(u);
  if (u.role === "requester") f.requesterId = u._id;
  if (u.role === "technician") {
    const orders = await (
      await db()
    )
      .collection<Row>("workOrders")
      .find(
        { ...scope(u), assigneeIds: u._id },
        { projection: { requestId: 1 } },
      )
      .toArray();
    f._id = { $in: orders.map((o) => o.requestId) };
  }
  return f;
}
async function workFilter(u: User): Promise<Record<string, any>> {
  const f: Record<string, any> = scope(u);
  if (u.role === "technician") f.assigneeIds = u._id;
  if (u.role === "requester") {
    const requests = await (
      await db()
    )
      .collection<Row>("repairRequests")
      .find({ ...scope(u), requesterId: u._id }, { projection: { _id: 1 } })
      .toArray();
    f.requestId = { $in: requests.map((r) => r._id) };
  }
  return f;
}
async function route(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    return NextResponse.json(await handle(req, ctx), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof ApiError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof z.ZodError)
      return NextResponse.json(
        { error: "กรุณาตรวจสอบข้อมูลที่กรอก" },
        { status: 400 },
      );
    if ((e as { code?: number }).code === 11000)
      return NextResponse.json(
        { error: "ข้อมูลซ้ำ กรุณาโหลดใหม่หรือตรวจสอบรหัส" },
        { status: 409 },
      );
    //console.error("API failed", e instanceof Error ? e.name : "unknown");
    console.error("API failed", {
      name: e instanceof Error ? e.name : "unknown",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    console.error(
      "[CMMS API ERROR]",
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return NextResponse.json(
      { error: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ" },
      { status: 500 },
    );
  }
}
export const GET = route;
export const POST = route;
