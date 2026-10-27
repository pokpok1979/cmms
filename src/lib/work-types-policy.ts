import { z } from "zod";
import type { User } from "./domain";
export const defaultWorkTypeNames=["งานไฟฟ้า","งานประปา","เครื่องปรับอากาศ","อาคารและโครงสร้าง","ระบบดับเพลิง","เครื่องจักรการผลิต","ระบบลมอัด","ระบบน้ำและสาธารณูปโภค","อุปกรณ์สนับสนุนการผลิต","อื่น ๆ"];
export type WorkType={_id:string;companyId:string;siteId:string;name:string;nameKey:string;description:string;revision:number;deletedAt:Date|string|null};
export function workTypeNameKey(name:string){return name.trim().replace(/\s+/g," ").normalize("NFC").toLowerCase();}
export function defaultWorkTypes(companyId:string,siteId:string):WorkType[]{return defaultWorkTypeNames.map((name,index)=>({_id:`work-type:${encodeURIComponent(companyId)}:${encodeURIComponent(siteId)}:default:${index+1}`,companyId,siteId,name,nameKey:workTypeNameKey(name),description:"",revision:0,deletedAt:null}));}
export function mergeWorkTypes(grants:{companyId:string;siteId:string}[],stored:WorkType[]){
  const map=new Map<string,WorkType>();
  for(const grant of grants)for(const row of defaultWorkTypes(grant.companyId,grant.siteId))map.set(row._id,row);
  for(const row of stored)if(grants.some(grant=>grant.companyId===row.companyId&&grant.siteId===row.siteId))map.set(row._id,row);
  return [...map.values()].filter(row=>!row.deletedAt).sort((a,b)=>a.name.localeCompare(b.name,"th")||a._id.localeCompare(b._id));
}
export function canManageWorkTypes(actor:Pick<User,"role"|"grants">,target:{companyId:string;siteId:string}){return actor.role==="admin"&&actor.grants.some(grant=>grant.companyId===target.companyId&&grant.siteId===target.siteId);}
export function resolveWorkType(choices:WorkType[],target:{companyId:string;siteId:string;workTypeId?:string;category?:string}){
  return choices.find(row=>!row.deletedAt&&row.companyId===target.companyId&&row.siteId===target.siteId&&(target.workTypeId?row._id===target.workTypeId:row.nameKey===workTypeNameKey(target.category || ""))) || null;
}
const scopeFields={companyId:z.string().min(1).max(100),siteId:z.string().min(1).max(100),revision:z.number().int().min(0)};
export const workTypeChangeSchema=z.discriminatedUnion("action",[
  z.object({...scopeFields,action:z.literal("save"),id:z.string().min(1).max(2000).optional(),name:z.string().trim().min(1).max(150),description:z.string().trim().max(500)}).strict(),
  z.object({...scopeFields,action:z.literal("delete"),id:z.string().min(1).max(2000)}).strict(),
]);