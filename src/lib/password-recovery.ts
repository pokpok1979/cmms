import type { Db, ClientSession } from "mongodb";
import type { Row } from "./db";
import { ApiError } from "./auth";
import { hashResetToken } from "./password-recovery-policy";

// The caller wraps this operation in the same transaction as the audit record.
export async function finishPasswordReset(d: Db, session: ClientSession | undefined, token: string, passwordHash: string, now = new Date()) {
  const ticket = await d.collection<Row>("passwordResets").findOneAndDelete({_id:hashResetToken(token),expiresAt:{$gt:now}},{session});
  if (!ticket) throw new ApiError(400,"ลิงก์ไม่ถูกต้อง หมดอายุ หรือใช้งานไปแล้ว กรุณาขอลิงก์ใหม่");
  const account = await d.collection<Row>("users").findOne({_id:ticket.userId,active:true},{session});
  if (!account || account.email!==ticket.email || (account.passwordHash || "")!==ticket.credentialHash)
    throw new ApiError(400,"ลิงก์นี้ใช้ไม่ได้แล้ว กรุณาขอลิงก์ใหม่หรือติดต่อผู้ดูแลระบบ");
  await d.collection<Row>("users").updateOne({_id:account._id},{$set:{passwordHash,authSource:"local",updatedAt:now}},{session});
  await d.collection("sessions").deleteMany({userId:account._id},{session});
  await d.collection("passwordResets").deleteMany({userId:account._id},{session});
  return account;
}
