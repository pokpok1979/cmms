import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export const recoveryRequestSchema = z.object({ email: z.string().trim().pipe(z.email().max(254)).transform(value => value.toLowerCase()) });
export const passwordResetSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(12, "รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร").max(200),
  confirmPassword: z.string().max(200),
}).refine(value => value.password === value.confirmPassword, {message:"รหัสผ่านยืนยันไม่ตรงกัน",path:["confirmPassword"]});
export const recoveryMessage = "หากอีเมลนี้ตรงกับบัญชีที่ใช้งานอยู่ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ กรุณาตรวจสอบกล่องจดหมายและอีเมลขยะ";
export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function issueResetToken(now = new Date()) {
  const token = randomBytes(32).toString("hex");
  return {token,hash:hashResetToken(token),expiresAt:new Date(now.getTime()+15*60*1000)};
}
export function resetUrl(appUrl: string, token: string) {
  const base = new URL(appUrl);
  if (!/^https?:$/.test(base.protocol) || base.username || base.password) throw Error("Invalid APP_URL");
  const url = new URL("/reset-password", base.origin);
  url.hash = new URLSearchParams({token}).toString();
  return url.toString();
}
