import { db,Row } from "./db";
import type { User } from "./domain";
import { defaultWorkTypes,mergeWorkTypes } from "./work-types-policy";
import type { WorkType } from "./work-types-policy";
import type { ClientSession } from "mongodb";
export async function readWorkTypes(d:Awaited<ReturnType<typeof db>>,actor:Pick<User,"grants">,session?:ClientSession){
  const grants=actor.grants;
  const match={$or:grants.length?grants.map(grant=>({companyId:grant.companyId,siteId:grant.siteId})):[{siteId:"__none__"}]};
  const stored=await d.collection<Row>("workTypes").find(match,{session}).toArray();
  return mergeWorkTypes(grants,stored as unknown as WorkType[]);
}
let indexPromise:Promise<string>|undefined;
export function ensureWorkTypeIndex(d:Awaited<ReturnType<typeof db>>){
  return indexPromise ||= d.collection("workTypes").createIndex({companyId:1,siteId:1,nameKey:1},{name:"workTypes_active_name",unique:true,partialFilterExpression:{deletedAt:null}}).catch(error=>{indexPromise=undefined;throw error;});
}
export async function initializeWorkTypes(d:Awaited<ReturnType<typeof db>>,companyId:string,siteId:string,session:ClientSession){
  await d.collection<Row>("workTypes").bulkWrite(defaultWorkTypes(companyId,siteId).map(row=>({updateOne:{filter:{_id:row._id},update:{$setOnInsert:{...row,createdAt:new Date()}},upsert:true}})),{session});
}