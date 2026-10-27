import { NextResponse } from "next/server";
import { auditContext } from "@/lib/audit-context";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { tx, Row } from "@/lib/db";
import { user, origin, ApiError, hashPassword } from "@/lib/auth";
import { canManageUser } from "@/lib/admin-users-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    id: z.string().min(1).max(100),
    newPassword: z.string().min(12).max(200),
    confirmPassword: z.string().min(12).max(200),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "รหัสผ่านใหม่และรหัสผ่านยืนยันไม่ตรงกัน",
    path: ["confirmPassword"],
  });

export async function POST(req: Request) {
  try {
    origin(req);

    const actor = await user(req);
    if (actor.role !== "admin") {
      throw new ApiError(403, "ไม่มีสิทธิ์เปลี่ยนรหัสผ่านผู้ใช้งาน");
    }

    const v = schema.parse(await req.json());
    const passwordHash = hashPassword(v.newPassword);

    await tx(async (d, session) => {
      await d
        .collection<Row>("systemSettings")
        .updateOne(
          { _id: "admin-users-write-lock" },
          { $inc: { revision: 1 } },
          { upsert: true, session },
        );

      const admin = await d
        .collection<Row>("users")
        .findOne({ _id: actor._id, role: "admin", active: true }, { session });

      const target = await d
        .collection<Row>("users")
        .findOne({ _id: v.id }, { session });

      if (
        !admin ||
        !target ||
        !canManageUser(
          { role: "admin", grants: admin.grants || [] },
          target.grants || [],
        )
      ) {
        throw new ApiError(403, "ไม่พบผู้ใช้งานหรือไม่มีสิทธิ์แก้ไข");
      }

      await d
        .collection<Row>("users")
        .updateOne(
          { _id: target._id },
          { $set: { passwordHash, authSource: "local", updatedAt: new Date() } },
          { session },
        );

      await d
        .collection("sessions")
        .deleteMany({ userId: target._id }, { session });

      const grant = target.grants[0];

      await d.collection<Row>("auditLogs").insertOne(
        {
          _id: randomUUID(),
          entityId: target._id,
          actorId: actor._id,
          actorName: actor.name,
          reference: target.username,
          ...auditContext(req),
          companyId: grant.companyId,
          siteId: grant.siteId,
          event: "user.password.changed",
          at: new Date(),
        },
        { session },
      );
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }

    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message || "กรุณาตรวจสอบรหัสผ่าน" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่" },
      { status: 500 },
    );
  }
}
