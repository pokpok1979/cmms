import { z } from "zod";
import type { User } from "./domain";
import { canManageCompany } from "./companies-policy";
export const smtpSchema = z.object({
  companyId:z.string().min(1).max(100), revision:z.number().int().nonnegative(), enabled:z.boolean(),
  host:z.string().trim().min(1).max(253).regex(/^[a-zA-Z0-9.-]+$/,"กรอกชื่อ SMTP Server โดยไม่ใส่ smtp:// หรือพอร์ต"),
  port:z.number().int().min(1).max(65535), security:z.enum(["tls","starttls"]),
  authEnabled:z.boolean(), username:z.string().trim().max(254), password:z.string().max(2000).default(""),
  fromEmail:z.email().max(254), fromName:z.string().trim().max(120).regex(/^[^\r\n]*$/),
  appUrl:z.string().trim().max(500).refine(value=>{try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password&&!u.search&&!u.hash&&["","/"].includes(u.pathname);}catch{return false;}},"กรอก URL ของระบบ เช่น https://cmms.company.com"),
}).strict().refine(value=>!value.authEnabled||!!value.username,{message:"กรุณาระบุชื่อผู้ใช้ SMTP",path:["username"]});
export type SmtpConfig=z.infer<typeof smtpSchema>;
export const smtpDefaults:SmtpConfig={companyId:"",revision:0,enabled:false,host:"",port:587,security:"starttls",authEnabled:true,username:"",password:"",fromEmail:"",fromName:"AGE CMMS",appUrl:""};
export function canManageSmtp(actor:Pick<User,"role"|"grants">,companyId:string,sites:{_id:string;companyId:string}[]) {
  const companySites=sites.filter(s=>s.companyId===companyId);
  return companySites.length>0 && canManageCompany(actor,companyId,companySites.map(s=>({siteId:s._id})));
}
export function publicSmtpSettings(record:Record<string,any>) {
  return Object.fromEntries([...Object.keys(smtpDefaults).filter(key=>key!=="password").map(key=>[key,record[key]??smtpDefaults[key as keyof SmtpConfig]]),["hasPassword",!!record.secret]]);
}
export function recoveryCompany(account:{ldapCompanyId?:string;grants?:{companyId:string}[]}) {
  const grants=account.grants||[];
  return grants.find(g=>g.companyId===account.ldapCompanyId)?.companyId || grants[0]?.companyId;
}
