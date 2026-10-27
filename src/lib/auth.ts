import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { db, Row } from "./db";
import { User } from "./domain";
import { resolvePermissions, permitted, requestPermission } from "./permissions";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function hashPassword(p: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
}
export function verify(p: string, h: string) {
  if (!h) return false;
  const [salt, digest] = h.split(":");
  if (!salt || !digest) return false;
  const a = Buffer.from(digest, "hex"),
    b = scryptSync(p, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export async function user(req?: Request): Promise<User> {
  const token = (await cookies()).get("cmms_session")?.value;
  if (!token) throw new ApiError(401, "กรุณาเข้าสู่ระบบ");
  const d = await db();
  const session = await d
    .collection<Row>("sessions")
    .findOne({ _id: digest(token), expiresAt: { $gt: new Date() } });
  const u =
    session &&
    (await d
      .collection<Row>("users")
      .findOne({ _id: session.userId, active: true }));
  if (!u) throw new ApiError(401, "กรุณาเข้าสู่ระบบ");
  const policy = await d.collection<Row>("rolePermissions").findOne({ _id: u.role });
  const result: User = {
    _id: u._id,
    name: u.name,
    username: u.username,
    department: u.department || "",
    position: u.position || "",
    role: u.role,
    grants: u.grants,
    permissions: resolvePermissions(u.role, policy?.matrix),
  };
  if (req) {
    const permission = await requestPermission(req);
    if (permission && !permitted(result, permission.module, permission.action)) throw new ApiError(403, "ไม่มีสิทธิ์ดำเนินการตามบทบาท & สิทธิ์");
  }
  return result;
}
export const SESSION_DAYS = 30;
export async function login(
  username: string,
  password: string,
) {
  const d = await db();
  const key = digest(username.toLowerCase());
  const bucket = Math.floor(Date.now() / 900000);
  const limit = await d.collection<Row>("rateLimits").findOneAndUpdate(
    { _id: key + bucket },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(Date.now() + 1800000) },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (limit!.count > 20) throw new ApiError(429, "ลองเข้าสู่ระบบใหม่ภายหลัง");
  const u = await d
    .collection<Row>("users")
    .findOne({ username: username.toLowerCase(), active: true });
  const authenticated = verify(password, u?.passwordHash || "fixed:" + "00".repeat(64));
  if (!authenticated)
    throw new ApiError(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");

  const token = randomBytes(32).toString("hex");
  const sessionSeconds = SESSION_DAYS * 24 * 60 * 60;

  await d.collection<Row>("sessions").insertOne({
    _id: digest(token),
    userId: u!._id,
    expiresAt: new Date(Date.now() + sessionSeconds * 1000),
  });

  (await cookies()).set("cmms_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionSeconds,
  });
  await d
    .collection<Row>("users")
    .updateOne({ _id: u!._id }, { $set: { lastLoginAt: new Date() } });
  return u!;
}
export async function logout() {
  const c = await cookies();
  const token = c.get("cmms_session")?.value;
  if (token)
    await (await db())
      .collection<Row>("sessions")
      .deleteOne({ _id: digest(token) });
  c.delete("cmms_session");
}
export function origin(req: Request) {
  if (
    req.headers.get("origin") !== new URL(process.env.APP_URL || req.url).origin
  )
    throw new ApiError(403, "คำขอไม่ถูกต้อง");
}
