import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db, type Row } from "@/lib/db";
import { origin, ApiError, digest } from "@/lib/auth";
import { recoveryRequestSchema, issueResetToken, recoveryMessage } from "@/lib/password-recovery-policy";
import { recoveryMailSettings, sendRecoveryMail } from "@/lib/password-recovery-mail";
import { recoveryCompany } from "@/lib/smtp-policy";

export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    origin(req);
    const input = recoveryRequestSchema.safeParse(await req.json().catch(()=>null));
    if (!input.success) return NextResponse.json({error:"กรุณาระบุอีเมลให้ถูกต้อง"},{status:400});
    const d = await db(), now = new Date(), bucket = Math.floor(now.getTime()/900000);
    const limit = async (key:string) => d.collection<Row>("rateLimits").findOneAndUpdate({_id:`recovery:${digest(key)}:${bucket}`},
      {$inc:{count:1},$setOnInsert:{expiresAt:new Date(now.getTime()+1800000)}},{upsert:true,returnDocument:"after"});
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
    if ((await limit(`ip:${ip}`))!.count>20) return NextResponse.json({error:"ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลัง"},{status:429});
    const reply = () => NextResponse.json({ok:true,message:recoveryMessage});
    if ((await limit(`email:${input.data.email}`))!.count>3) return reply();
    const accounts = await d.collection<Row>("users").find({email:input.data.email,active:true}).limit(2).toArray();
    if (accounts.length!==1) return reply();
    const account = accounts[0], companyId=recoveryCompany({ldapCompanyId:account.ldapCompanyId,grants:account.grants});
    if(!companyId)return reply();
    let settings:Awaited<ReturnType<typeof recoveryMailSettings>>;
    try {settings=await recoveryMailSettings(companyId);}catch{
      console.error("Password recovery SMTP configuration unavailable",{companyId});
      return reply();
    }
    const issued = issueResetToken(now);
    await d.collection("passwordResets").createIndex({expiresAt:1},{expireAfterSeconds:0});
    await d.collection<Row>("passwordResets").insertOne({_id:issued.hash,userId:account._id,email:account.email,
      credentialHash:account.passwordHash || "",createdAt:now,expiresAt:issued.expiresAt});
    try {
      await sendRecoveryMail(account.email,issued.token,settings);
    } catch {
      await d.collection<Row>("passwordResets").deleteOne({_id:issued.hash});
      console.error("Password recovery email delivery failed",{reference:randomUUID()});
    }
    return reply();
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({error:error.message},{status:error.status});
    console.error("Password recovery request failed",{reference:randomUUID()});
    return NextResponse.json({error:"ส่งคำขอไม่สำเร็จ กรุณาลองใหม่"},{status:500});
  }
}
