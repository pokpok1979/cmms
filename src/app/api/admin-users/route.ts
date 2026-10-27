import { NextResponse } from "next/server";
import { auditContext } from "@/lib/audit-context";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, tx, Row } from "@/lib/db";
import { user, origin, ApiError, hashPassword } from "@/lib/auth";
import {
  canManageUser,
  userRoles,
  userScopeQuery,
  normalizeEmail,
  escapeUserSearch,
} from "@/lib/admin-users-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const grantSchema = z.object({
  companyId: z.string().min(1).max(100),
  siteId: z.string().min(1).max(100),
});
const formSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._@\\-]{3,80}$/),
  name: z.string().trim().min(1).max(200),
  email: z.union([z.literal(""), z.email().max(254)]).transform(normalizeEmail),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+().\s-]*$/),
  department: z.string().trim().max(120),
  position: z.string().trim().max(120),
  role: z.enum(userRoles),
  active: z.boolean(),
  grants: z.array(grantSchema).min(1).max(100),
  password: z.string().min(12).max(200).optional(),
});
function denied(status: number, message: string): never {
  throw new ApiError(status, message);
}
function respondError(e: unknown) {
  if (e instanceof ApiError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError)
    return NextResponse.json(
      { error: "กรุณาตรวจสอบข้อมูล ชื่อ-นามสกุล อีเมล โทรศัพท์ และรหัสผ่าน" },
      { status: 400 },
    );
  if ((e as { code?: number })?.code === 11000)
    return NextResponse.json(
      { error: "User ID หรือ E-mail ซ้ำ กรุณาตรวจสอบ" },
      { status: 409 },
    );
  console.error("Admin users failed", e instanceof Error ? e.name : "unknown");
  return NextResponse.json(
    { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" },
    { status: 500 },
  );
}
export async function GET(req: Request) {
  try {
    const actor = await user(req);
    if (actor.role !== "admin") denied(403, "ไม่มีสิทธิ์จัดการผู้ใช้งาน");
    const d = await db();
    const base = userScopeQuery(actor);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
    const role = url.searchParams.get("role") || "";
    const department = (url.searchParams.get("department") || "").slice(0, 120);
    const status = url.searchParams.get("status") || "";
    const page = Math.max(
      1,
      Math.min(10000, Math.floor(Number(url.searchParams.get("page")) || 1)),
    );
    const filters: Record<string, unknown>[] = [base];
    if (q)
      filters.push({
        $or: [
          "username",
          "name",
          "email",
          "phone",
          "department",
          "position",
        ].map((field) => ({
          [field]: { $regex: escapeUserSearch(q), $options: "i" },
        })),
      });
    if (role) filters.push({ role });
    if (department) filters.push({ department });
    if (status === "active") filters.push({ active: true });
    if (status === "suspended") filters.push({ active: { $ne: true } });
    const filter = { $and: filters };
    const users = d.collection<Row>("users");
    const [items, total, all, active, admins, departments] = await Promise.all([
      users
        .find(filter, {
          projection: {
            username: 1,
            name: 1,
            email: 1,
            phone: 1,
            department: 1,
            position: 1,
            role: 1,
            active: 1,
            grants: 1,
            lastLoginAt: 1,
            authSource: 1,
          },
        })
        .sort({ name: 1, _id: 1 })
        .skip((page - 1) * 20)
        .limit(20)
        .toArray(),
      users.countDocuments(filter),
      users.countDocuments(base),
      users.countDocuments({ $and: [base, { active: true }] }),
      users.countDocuments({ $and: [base, { role: "admin", active: true }] }),
      users.distinct("department", base),
    ]);
    const activityRows = items.length
      ? await d
          .collection("auditLogs")
          .aggregate<{ _id: string; count: number }>([
            {
              $match: {
                actorId: { $in: items.map((item) => item._id) },

                // นับเฉพาะกิจกรรมในขอบเขตที่ Admin เข้าถึงได้
                $or: actor.grants.map((grant) => ({
                  companyId: grant.companyId,
                  siteId: grant.siteId,
                })),

                // การอนุมัติคำขอสร้างใบงานต่อให้อัตโนมัติ
                // จึงไม่นับ event นี้ซ้ำอีกครั้ง
                event: { $ne: "workOrder.created" },
              },
            },
            {
              $group: {
                _id: "$actorId",
                count: { $sum: 1 },
              },
            },
          ])
          .toArray()
      : [];

    const activityCounts = new Map(
      activityRows.map((row) => [row._id, row.count]),
    );

    const itemsWithActivity = items.map((item) => ({
      ...item,
      activityCount: activityCounts.get(item._id) ?? 0,
    }));
    return NextResponse.json(
      {
        //items,
        items: itemsWithActivity,
        total,
        page,
        pageSize: 20,
        stats: { total: all, active, suspended: all - active, admins },
        departments: departments.filter(Boolean).sort(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return respondError(e);
  }
}
export async function POST(req: Request) {
  try {
    origin(req);
    const actor = await user(req);
    if (actor.role !== "admin") denied(403, "ไม่มีสิทธิ์จัดการผู้ใช้งาน");
    const v = formSchema.parse(await req.json());
    if (v.id && v.password) {
      denied(400, "กรุณาใช้ปุ่มกุญแจเพื่อเปลี่ยนรหัสผ่าน");
    }
    if (!v.id && !v.password)
      denied(400, "กรุณากำหนดรหัสผ่านอย่างน้อย 12 ตัวอักษร");
    if (!canManageUser(actor, v.grants)) denied(403, "ขอบเขตสิทธิ์ไม่ถูกต้อง");
    if (v.id === actor._id && (!v.active || v.role !== "admin"))
      denied(400, "ไม่สามารถระงับหรือลดบทบาทบัญชี Admin ที่กำลังใช้งาน");
    const id = v.id || randomUUID();
    const newHash = v.password ? hashPassword(v.password) : undefined;
    await tx(async (d, s) => {
      // Serialize account mutations, then recheck the actor inside the transaction.
      await d
        .collection<Row>("systemSettings")
        .updateOne(
          { _id: "admin-users-write-lock" },
          { $inc: { revision: 1 } },
          { upsert: true, session: s },
        );
      const currentActor = await d
        .collection<Row>("users")
        .findOne(
          { _id: actor._id, active: true, role: "admin" },
          { session: s },
        );
      if (
        !currentActor ||
        !canManageUser(
          { role: "admin", grants: currentActor.grants || [] },
          v.grants,
        )
      )
        denied(403, "สิทธิ์เปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่");
      const old = v.id
        ? await d.collection<Row>("users").findOne({ _id: id }, { session: s })
        : null;
      if (
        v.id &&
        (!old ||
          !canManageUser(
            { role: "admin", grants: currentActor.grants || [] },
            old.grants || [],
          ))
      )
        denied(404, "ไม่พบผู้ใช้งานหรือไม่มีสิทธิ์แก้ไข");
      if (old && old.username !== v.username.toLowerCase())
        denied(400, "ไม่สามารถเปลี่ยน User ID ของบัญชีเดิม");
      const grants = v.grants.filter(
        (g, i, a) =>
          a.findIndex(
            (x) => x.companyId === g.companyId && x.siteId === g.siteId,
          ) === i,
      );
      for (const g of grants) {
        const site = await d
          .collection<Row>("sites")
          .findOne(
            { _id: g.siteId, companyId: g.companyId, deletedAt: null },
            { session: s },
          );
        if (!site) denied(400, "ไม่พบสาขาที่เลือก");
      }
      const duplicate = await d.collection<Row>("users").findOne(
        {
          _id: { $ne: id },
          $or: [
            { username: v.username.toLowerCase() },
            ...(v.email
              ? [
                  {
                    email: {
                      $regex: "^" + escapeUserSearch(v.email) + "$",
                      $options: "i",
                    },
                  },
                ]
              : []),
          ],
        },
        { session: s, projection: { _id: 1 } },
      );
      if (duplicate) denied(409, "User ID หรือ E-mail ซ้ำ กรุณาตรวจสอบ");
      const fields = {
        username: v.username.toLowerCase(),
        name: v.name,
        email: v.email,
        phone: v.phone,
        department: old?.ldapCompanyId ? old.department || "" : v.department,
        position: old?.ldapCompanyId ? old.position || "" : v.position,
        role: v.role,
        active: v.active,
        grants,
        updatedAt: new Date(),
        ...(newHash ? { passwordHash: newHash } : {}),
      };
      if (old)
        await d
          .collection<Row>("users")
          .updateOne({ _id: id }, { $set: fields }, { session: s });
      else
        await d
          .collection<Row>("users")
          .insertOne(
            { _id: id, ...fields, createdAt: new Date() },
            { session: s },
          );
      if (
        old &&
        (!v.active ||
          old.role !== v.role ||
          JSON.stringify(old.grants) !== JSON.stringify(grants) ||
          newHash)
      )
        await d
          .collection("sessions")
          .deleteMany({ userId: id }, { session: s });
      const g = grants[0];
      await d.collection<Row>("auditLogs").insertOne(
        {
          _id: randomUUID(),
          entityId: id,
          actorId: actor._id,
          actorName: actor.name,
          reference: v.username,
          ...auditContext(req),
          companyId: g.companyId,
          siteId: g.siteId,
          event: old ? "user.updated" : "user.created",
          at: new Date(),
          detail: {
            role: v.role,
            active: v.active,
            grants,
            changedFields: old
              ? Object.keys(fields).filter(
                  (key) =>
                    key !== "updatedAt" &&
                    key !== "passwordHash" &&
                    JSON.stringify(old[key]) !==
                      JSON.stringify(fields[key as keyof typeof fields]),
                )
              : Object.keys(fields).filter((key) => key !== "passwordHash"),
            passwordChanged: Boolean(newHash),
          },
        },
        { session: s },
      );
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return respondError(e);
  }
}

