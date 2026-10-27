import { NextResponse } from "next/server";
import { z } from "zod";
import { db, type Row } from "@/lib/db";
import { user, origin, ApiError } from "@/lib/auth";
import { scope } from "@/lib/domain";
import { visibleNotifications } from "@/lib/notification-inbox";

export const dynamic = "force-dynamic";
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof ApiError ? error.message : "ดำเนินการแจ้งเตือนไม่สำเร็จ" }, { status: error instanceof ApiError ? error.status : error instanceof z.ZodError ? 400 : 500 });
}
export async function GET(req: Request) {
  try {
    const actor = await user(req), d = await db();
    const visible = (await visibleNotifications(d, actor)).filter(row => !row.read);
    return NextResponse.json({ items: visible.slice(0, 100), unread: visible.filter(row => !row.read).length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    origin(req);
    const actor = await user(req);
    const value = z.object({ id: z.string().min(1).max(100).optional(), all: z.boolean().optional() }).refine(v => v.all === true || !!v.id).parse(await req.json());
    const d = await db(), visible = await visibleNotifications(d, actor, value.all ? undefined : value.id);
    const ids = visible.filter(row => value.all || row._id === value.id).map(row => row._id);
    await d.collection<Row>("notifications").deleteMany({ recipientId: actor._id, _id: { $in: ids }, ...scope(actor) });
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
