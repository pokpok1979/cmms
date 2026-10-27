import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "../src/lib/domain";
import { canManageCompany,companyChangeSchema,companyRevisionMatch,companyDeletionBlock } from "../src/lib/companies-policy";
const admin:User={_id:"admin",username:"admin",name:"ผู้ดูแล",role:"admin",grants:[{companyId:"A",siteId:"1"},{companyId:"B",siteId:"2"}]};
test("company edits require admin and access to every company branch",()=>{
  assert.equal(canManageCompany(admin,"A",[{siteId:"1"}]),true);
  assert.equal(canManageCompany(admin,"A",[{siteId:"1"},{siteId:"3"}]),false);
  assert.equal(canManageCompany(admin,"C",[]),false);
  assert.equal(canManageCompany({...admin,role:"supervisor"},"A",[{siteId:"1"}]),false);
});
test("new companies validate codes and require an initial branch",()=>{
  const value={action:"save",code:"new-co",revision:0,nameTh:"บริษัททดสอบ",nameEn:"",phone:"",email:"",website:"",address:"",firstSiteName:"สำนักงานใหญ่"};
  const parsed=companyChangeSchema.parse(value);
  assert.ok(parsed.action==="save");
  if(parsed.action==="save")assert.equal(parsed.code,"NEW-CO");
  for(const patch of [{nameTh:" "},{firstSiteName:""},{code:"../invalid"},{revision:-1},{email:"not-email"},{role:"admin"}])assert.equal(companyChangeSchema.safeParse({...value,...patch}).success,false);
  assert.ok(companyChangeSchema.safeParse({...value,id:"NEW-CO",firstSiteName:""}).success);
});
test("company deletion rejects referenced companies and the last accessible company",()=>{
  assert.equal(companyDeletionBlock(admin,"A",false),null);
  assert.equal(companyDeletionBlock(admin,"A",true),"has-references");
  assert.equal(companyDeletionBlock({...admin,grants:[{companyId:"A",siteId:"1"} ]},"A",false),"last-company");
});
test("company concurrency handles existing records without a revision",()=>{
  assert.deepEqual(companyRevisionMatch(undefined),{revision:{$exists:false}});
  assert.deepEqual(companyRevisionMatch(0),{revision:0});
  assert.deepEqual(companyRevisionMatch(4),{revision:4});
});