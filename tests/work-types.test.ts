import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "../src/lib/domain";
import { defaultWorkTypes,mergeWorkTypes,canManageWorkTypes,resolveWorkType,workTypeNameKey,workTypeChangeSchema } from "../src/lib/work-types-policy";
const admin:User={_id:"a",username:"admin",name:"ผู้ดูแล",role:"admin",grants:[{companyId:"A",siteId:"1"},{companyId:"B",siteId:"2"}]};
test("work type changes require admin and an exact company/site grant",()=>{
  assert.equal(canManageWorkTypes(admin,{companyId:"A",siteId:"1"}),true);
  assert.equal(canManageWorkTypes(admin,{companyId:"A",siteId:"2"}),false);
  assert.equal(canManageWorkTypes({...admin,role:"supervisor"},{companyId:"A",siteId:"1"}),false);
  assert.equal(canManageWorkTypes({...admin,grants:[]},{companyId:"A",siteId:"1"}),false);
});
test("default work types preserve existing choices until their scoped records are changed",()=>{
  const defaults=defaultWorkTypes("A","1");
  assert.equal(defaults.length,10);
  assert.equal(resolveWorkType(defaults,{companyId:"A",siteId:"1",category:"งานไฟฟ้า"})?.name,"งานไฟฟ้า");
  assert.notEqual(defaultWorkTypes("A:B","C")[0]._id,defaultWorkTypes("A","B:C")[0]._id);
});
test("deleted defaults do not reappear and edits override original names",()=>{
  const defaults=defaultWorkTypes("A","1");
  const deleted={...defaults[0],deletedAt:new Date()};
  const edited={...defaults[1],name:"งานทดสอบ",nameKey:workTypeNameKey("งานทดสอบ"),revision:1};
  const choices=mergeWorkTypes([{companyId:"A",siteId:"1"}],[deleted,edited]);
  assert.equal(choices.length,9);
  assert.equal(choices.some(row=>row._id===deleted._id),false);
  assert.equal(choices.find(row=>row._id===edited._id)?.name,"งานทดสอบ");
  assert.equal(resolveWorkType(choices,{companyId:"A",siteId:"1",workTypeId:deleted._id}),null);
  assert.equal(defaults[1].name,"งานประปา");
});
test("request work types cannot cross scopes or bypass a deleted/unknown identifier",()=>{
  const defaults=defaultWorkTypes("A","1");
  const outside=defaultWorkTypes("B","2")[0];
  const choices=mergeWorkTypes([{companyId:"A",siteId:"1"}],[outside]);
  assert.equal(choices.some(row=>row.companyId==="B"),false);
  assert.equal(resolveWorkType(choices,{companyId:"A",siteId:"2",workTypeId:defaults[0]._id}),null);
  assert.equal(resolveWorkType(choices,{companyId:"A",siteId:"1",workTypeId:"missing",category:"งานไฟฟ้า"}),null);
});
test("work type payloads validate names, actions and concurrency revision",()=>{
  const value={action:"save",companyId:"A",siteId:"1",revision:0,name:"ประเภทใหม่",description:""};
  assert.ok(workTypeChangeSchema.safeParse(value).success);
  for(const patch of [{name:" "},{name:"x".repeat(151)},{revision:-1},{action:"other"},{role:"admin"}])assert.equal(workTypeChangeSchema.safeParse({...value,...patch}).success,false);
  assert.equal(workTypeChangeSchema.safeParse({action:"delete",companyId:"A",siteId:"1",revision:0}).success,false);
  assert.equal(workTypeNameKey(" Electric   Repair "),"electric repair");
});