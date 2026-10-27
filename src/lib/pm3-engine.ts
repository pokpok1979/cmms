import type { Filter,ClientSession,Db } from 'mongodb';
import { tx,Row } from './db';
import { bangkokDay,cycleDay } from './pm-calendar';
import { addDays,occurrenceId } from './pm3-policy';
async function notice(d:Db,s:ClientSession,j:Row,kind:string,message:string,now:Date){const r=await d.collection<Row>('notifications').updateOne({_id:`pm3:${j._id}:${kind}`},{$setOnInsert:{companyId:j.companyId,siteId:j.siteId,recipientId:j.assigneeId,module:'pm',message,at:now,read:false,entityId:j._id}},{upsert:true,session:s});return r.upsertedCount;}
export async function generatePM3(now=new Date(),filter:Filter<Row>={}){
 const today=bangkokDay(now);
 return tx(async(d,s)=>{
  await d.collection<Row>('systemSettings').updateOne({_id:'pm-worker-lock'},{$inc:{revision:1}},{upsert:true,session:s});
  const plans=await d.collection<Row>('pmPlans').find({...filter,active:true,nextDue:{$lte:addDays(today,30)},$expr:{$lte:[{$dateFromString:{dateString:'$nextDue',format:'%Y-%m-%d',timezone:'UTC'}},{$dateAdd:{startDate:new Date(today+'T00:00:00Z'),unit:'day',amount:{$ifNull:['$leadDays',3]}}}]}},{session:s}).sort({nextDue:1,_id:1}).limit(20).toArray();let created=0,notified=0;
  for(const p of plans){let index=Number(p.nextIndex||0),due=String(p.nextDue),steps=0;const horizon=addDays(today,Number(p.leadDays??3));
   while(due<=horizon&&steps++<20){const id=occurrenceId(p._id,Number(p.version||0),index);const job:Row={_id:id,companyId:p.companyId,siteId:p.siteId,planId:p._id,planVersion:p.version||0,assetId:p.assetId,assetName:p.assetName,title:p.title,assigneeId:p.assigneeId,due,status:'pending',checklist:p.checklist,createdAt:now};
    const existing=await d.collection<Row>('pmOccurrences').findOne({planId:p._id,due},{session:s});
    const r=existing?{upsertedCount:0}:await d.collection<Row>('pmOccurrences').updateOne({_id:id},{$setOnInsert:job},{upsert:true,session:s});
    if(r.upsertedCount){created++;if(due>=today)notified+=await notice(d,s,job,due>today?'upcoming':'due',(due>today?'PM ใกล้ถึงกำหนด ':'ถึงกำหนด PM ')+due+': '+p.title,now);}
    index++;due=cycleDay(p.start,p.unit,p.interval,index);
   }
   await d.collection<Row>('pmPlans').updateOne({_id:p._id},{$set:{nextIndex:index,nextDue:due,backlog:due<=horizon}},{session:s});
  }
  // Markers live on each job so a capped batch advances on the next invocation.
  for(const kind of ['due','overdue'] as const){const marker=kind==='due'?'dueNotified':'overdueNotified';const jobs=await d.collection<Row>('pmOccurrences').find({...filter,status:'pending',due:kind==='due'?today:{$lt:today},[marker]:{$ne:true}},{session:s}).sort({due:1,_id:1}).limit(200).toArray();for(const j of jobs){notified+=await notice(d,s,j,kind,(kind==='due'?'ถึงกำหนด PM วันนี้: ':'PM เกินกำหนด '+j.due+': ')+j.title,now);await d.collection<Row>('pmOccurrences').updateOne({_id:j._id},{$set:{[marker]:true}},{session:s});}}
  return {created,notified,processedPlans:plans.length};
 });
}
