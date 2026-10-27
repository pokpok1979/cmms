import { z } from "zod";
import type { User } from "./domain";
const attribute=z.string().regex(/^[a-zA-Z][a-zA-Z0-9;-]{0,99}$/);
export const ldapConfigSchema=z.object({
  companyId:z.string().min(1).max(100),revision:z.number().int().nonnegative(),
  enabled:z.boolean(),mode:z.enum(["ldap","sync"]).default("sync").transform(()=>"sync" as const),directory:z.enum(["ad","openldap"]),
  verifyTlsCertificate:z.boolean().default(true),
  ldapTransport:z.enum(["starttls","plain"]).default("starttls"),
  url:z.string().max(300).refine(value=>{try{const u=new URL(value);return ["ldap:","ldaps:"].includes(u.protocol)&&!!u.hostname&&!u.username&&!u.password&&["","/"].includes(u.pathname)&&!u.search&&!u.hash;}catch{return false;}},"กรุณาระบุ ldap://host:389 หรือ ldaps://host:636"),
  baseDn:z.string().trim().min(1).max(1000),bindDn:z.string().trim().min(1).max(1000),
  bindPassword:z.string().max(2000).optional(),caCertificate:z.string().max(30000).default(""),
  filter:z.string().trim().min(3).max(2000).refine(v=>v.startsWith("(")&&v.endsWith(")")),
  usernameAttribute:attribute,nameAttribute:attribute,emailAttribute:attribute,
  siteId:z.string().min(1).max(100),departmentAttribute:attribute.default("department"),positionAttribute:attribute.default("title"),
}).strict();
export type LdapConfig=z.infer<typeof ldapConfigSchema>;
export function ldapConnectionSecurity(config:{url:string;ldapTransport?:"starttls"|"plain"}) {
  return config.url.startsWith("ldaps:")?"ldaps":config.ldapTransport==="plain"?"plain":"starttls";
}
export function ldapTlsOptions(config:Pick<LdapConfig,"caCertificate"> & {verifyTlsCertificate?:boolean}) {
  return {minVersion:"TLSv1.2" as const,rejectUnauthorized:config.verifyTlsCertificate!==false,...(config.verifyTlsCertificate!==false&&config.caCertificate?{ca:config.caCertificate}:{})};
}
export function canSetupLdap(actor:Pick<User,"role"|"grants">,companyId:string,sites:{_id:string}[]) {
  return actor.role==="admin"&&sites.length>0&&sites.every(site=>actor.grants.some(g=>g.companyId===companyId&&g.siteId===site._id));
}
export function escapeLdapFilter(value:string) {return value.replace(/[\\*()\0]/g,char=>`\\${char.charCodeAt(0).toString(16).padStart(2,"0")}`);}
export function ldapLoginName(account:string){
  const username=account.trim().toLowerCase();
  if(!/^[a-z0-9._@\\-]{3,80}$/i.test(username))throw new Error("ชื่อบัญชี LDAP ไม่รองรับ");
  return username;
}
