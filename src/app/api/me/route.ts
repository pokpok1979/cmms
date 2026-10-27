import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  // Anonymous visits must not load the application API or wait for MongoDB.
  if (!(await cookies()).get("cmms_session")?.value) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers });
  }
  const { user, ApiError } = await import("@/lib/auth");
  try {
    return NextResponse.json(await user(req), { headers });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    console.error("Session lookup failed");
    return NextResponse.json({ error: "ไม่สามารถตรวจสอบการเข้าสู่ระบบได้" }, { status: 503, headers });
  }
}
