import type { Row } from '../src/lib/db';
﻿import nextEnv from '@next/env';
import assert from 'node:assert/strict';
nextEnv.loadEnvConfig(process.cwd());
const productionDatabase = process.env.MONGODB_DB || 'cmms';
const verificationDatabase = `cmms_pm3_verify_${Date.now()}`;
process.env.MONGODB_DB = verificationDatabase;
async function main(){
 const {db,connection}=await import('../src/lib/db');
 // The Atlas account is limited to the application's database. Route every
 // verification collection to a unique prefix; no production collection is used.
 const client=connection(),originalDb=client.db.bind(client),actual=originalDb(productionDatabase);
 const prefix=verificationDatabase+'_';
 const verificationCollections=new Set<string>();
 const testDb=new Proxy(actual,{get(target,key){
  if(key==='databaseName')return verificationDatabase;
  if(key==='collection')return (name:string)=>{const isolated=prefix+name;verificationCollections.add(isolated);return target.collection(isolated);};
  if(key==='dropDatabase')return ()=>{throw Error('Database deletion is disabled in verification');};
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
 }});
 client.db=((...args:Parameters<typeof client.db>)=>args[0]===verificationDatabase?testDb:originalDb(...args)) as typeof client.db;
 const {savePlan,togglePlan,completePM,defectRequest,report,querySchema,scopedJob}=await import('../src/lib/pm3-service');
 const {generatePM3}=await import('../src/lib/pm3-engine');
 const {bangkokDay}=await import('../src/lib/pm-calendar');
 const {addDays}=await import('../src/lib/pm3-policy');
 const {visibleNotifications}=await import('../src/lib/notification-inbox');
 const d=await db();let created=true;
 try{
  assert.equal(d.databaseName,verificationDatabase);
  assert.notEqual(d.databaseName,productionDatabase);
  const grants=[{companyId:'TEST',siteId:'SITE'}];
  const admin={_id:'admin',name:'Admin',username:'admin',role:'admin' as const,grants};
  const tech={_id:'tech',name:'Tech',username:'tech',role:'technician' as const,grants};
  const other={...tech,_id:'tech2',username:'tech2'};
  await d.collection<Row>('pmOccurrences').createIndex({planId:1,due:1},{unique:true});created=true;
  await d.collection<Row>('users').insertMany([{...admin,active:true},{...tech,active:true},{...other,active:true}]);
  await d.collection<Row>('assets').insertOne({_id:'asset' as any,...grants[0],name:'Test asset',locationId:'loc',deletedAt:null});
  await d.collection<Row>('locations').insertOne({_id:'loc' as any,...grants[0],name:'Test location',deletedAt:null});
  const today=bangkokDay();
  const plan={title:'Test plan',assetId:'asset',assigneeId:'tech',start:today,unit:'month' as const,interval:1,checklist:['Inspect','Clean'],leadDays:3};
  const saved=await savePlan(admin,plan);
  await Promise.all([generatePM3(),generatePM3()]);
  assert.equal(await d.collection<Row>('pmOccurrences').countDocuments({planId:saved.id}),1);
  assert.equal(await d.collection<Row>('notifications').countDocuments({recipientId:'tech'}),1);
  const job=await d.collection<Row>('pmOccurrences').findOne({planId:saved.id});assert.ok(job);
  assert.equal((await visibleNotifications(d,tech)).length,1);
  await assert.rejects(scopedJob(other,String(job._id)));
  await assert.rejects(scopedJob({...admin,grants:[{companyId:'OTHER',siteId:'SITE'}]},String(job._id)));
  await savePlan(admin,{...plan,title:'Revised plan',assigneeId:'tech2',checklist:['New inspection']},saved.id,0);
  assert.equal(await d.collection<Row>('pmPlanVersions').countDocuments({planId:saved.id}),2);
  const frozen=await d.collection<Row>('pmOccurrences').findOne({_id:job._id});
  assert.equal(frozen?.assigneeId,'tech');assert.deepEqual(frozen?.checklist,['Inspect','Clean']);
  await assert.rejects(savePlan(admin,{...plan,title:'Stale edit'},saved.id,0));
  await assert.rejects(completePM(other,String(job._id),['pass','fail'],''));
  await assert.rejects(completePM(tech,String(job._id),['pass'],''));
  await completePM(tech,String(job._id),['pass','fail'],'Seal needs repair');
  await assert.rejects(completePM(tech,String(job._id),['pass','pass'],''));
  const input={description:'Repair failed inspection',priority:'normal' as const,contact:'Test contact',department:'Maintenance'};
  const results=await Promise.all([defectRequest(tech,String(job._id),input),defectRequest(tech,String(job._id),input)]);
  assert.equal(results[0].id,results[1].id);
  assert.equal(await d.collection<Row>('repairRequests').countDocuments({sourcePMId:job._id}),1);
  assert.equal(await d.collection<Row>('notifications').countDocuments({recipientId:'admin',module:'repairRequests'}),1);
  const summary=await report(admin,querySchema.parse({from:today,to:today}));
  assert.equal(summary.counts.completed,1);assert.equal(summary.counts.failed,1);assert.equal(summary.counts.onTime,1);
  const upcoming=await savePlan(admin,{...plan,title:'Upcoming',start:addDays(today,2)});
  const past=await savePlan(admin,{...plan,title:'Overdue',start:addDays(today,-1)});
  await generatePM3();await generatePM3();
  assert.equal(await d.collection<Row>('notifications').countDocuments({_id:{$regex:`^pm3:pm:${upcoming.id}:0:upcoming$`}}),1);
  assert.equal(await d.collection<Row>('notifications').countDocuments({_id:{$regex:`^pm3:pm:${past.id}:0:overdue$`}}),1);
  await togglePlan(admin,upcoming.id,false);
  const paused=await d.collection<Row>('pmPlans').findOne({_id:upcoming.id as any});assert.equal(paused?.active,false);
  console.log('PASS: live isolated MongoDB verification — version history, immutable jobs, permissions, duplicate generation, concurrent defect creation, approver notifications, report counts, upcoming/overdue notices and pause.');
 }finally{
  if(created&&d.databaseName===verificationDatabase&&/^cmms_pm3_verify_\d+$/.test(d.databaseName)&&d.databaseName!==productionDatabase){for(const name of verificationCollections){assert.ok(name.startsWith(prefix));assert.ok(/^cmms_pm3_verify_\d+_/.test(name));await actual.collection(name).drop();}console.log('Isolated verification collections removed.');}
  await connection().close();
 }
}
main().catch(e=>{console.error('Phase 3 verification failed:',e instanceof Error?e.message:'unknown');process.exitCode=1;});
