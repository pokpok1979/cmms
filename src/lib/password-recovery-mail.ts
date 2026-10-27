import nodemailer from "nodemailer";
import { resetUrl } from "./password-recovery-policy";
import { db,type Row } from "./db";
import { openSmtpSecret } from "./smtp-secret";
import { smtpSchema,smtpDefaults } from "./smtp-policy";

export async function recoveryMailSettings(companyId:string) {
  const record=await (await db()).collection<Row>("smtpSettings").findOne({_id:companyId,enabled:true});
  if(!record)throw Error("Password recovery email is not configured");
  const fields=Object.fromEntries(Object.keys(smtpDefaults).map(key=>[key,key==="password"?"":record[key]]));
  const config=smtpSchema.parse(fields);
  if(config.authEnabled&&!record.secret)throw Error("SMTP password is not configured");
  return {host:config.host,port:config.port,from:{name:config.fromName,address:config.fromEmail},appUrl:config.appUrl,
    secure:config.security==="tls",
    ...(config.authEnabled ? {auth:{user:config.username,pass:openSmtpSecret(record.secret)}} : {}),
  };
}
export function smtpTransport(settings:Awaited<ReturnType<typeof recoveryMailSettings>>) {
  const {from,appUrl,...options}=settings;
  return nodemailer.createTransport({...options,requireTLS:!options.secure,
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
}
export async function sendRecoveryMail(email: string, token: string, settings:Awaited<ReturnType<typeof recoveryMailSettings>>) {
  const {from,appUrl} = settings;
  const transporter = smtpTransport(settings);
  await transporter.sendMail({from,to:email,subject:"AGE CMMS — ตั้งรหัสผ่านใหม่",
    text:`คุณได้รับอีเมลนี้เนื่องจากมีคำขอตั้งรหัสผ่าน AGE CMMS ใหม่\n\nเปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ภายใน 15 นาที:\n${resetUrl(appUrl,token)}\n\nลิงก์ใช้ได้ครั้งเดียว หากไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้ รหัสผ่านเดิมยังใช้ได้ตามปกติ`,
    disableFileAccess:true,disableUrlAccess:true,
  });
}
