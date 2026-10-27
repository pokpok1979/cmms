import { z } from "zod";
import type { User } from "./domain";
export function canManageCompany(actor:Pick<User,"role"|"grants">,companyId:string,sites:{siteId:string}[]){
  return actor.role==="admin"&&actor.grants.some(grant=>grant.companyId===companyId)&&sites.every(site=>actor.grants.some(grant=>grant.companyId===companyId&&grant.siteId===site.siteId));
}
export function companyDeletionBlock(actor:Pick<User,"grants">,companyId:string,hasReferences:boolean){
  if(!actor.grants.some(grant=>grant.companyId!==companyId))return "last-company";
  return hasReferences?"has-references":null;
}
export function companyRevisionMatch(revision:unknown){return typeof revision==="number"?{revision}:{revision:{$exists:false}};}
export const companyChangeSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("save"),id:z.string().min(1).max(100).optional(),revision:z.number().int().min(0),code:z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{0,29}$/,"รหัสบริษัทใช้ A–Z, 0–9, _ หรือ - ไม่เกิน 30 ตัว"),nameTh:z.string().trim().min(1).max(200),nameEn:z.string().trim().max(200),phone:z.string().trim().max(50).regex(/^[0-9+().\s-]*$/),email:z.union([z.literal(""),z.email().max(150)]),website:z.string().trim().max(150),address:z.string().trim().max(500),firstSiteName:z.string().trim().max(150)}).strict().refine(value=>Boolean(value.id||value.firstSiteName),{message:"กรุณาระบุโรงงาน / สาขาเริ่มต้น",path:["firstSiteName"]}),
  z.object({action:z.literal("delete"),id:z.string().min(1).max(100),revision:z.number().int().min(0)}).strict(),
]);