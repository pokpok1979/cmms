import test from "node:test";
import assert from "node:assert/strict";
import { canManageSettings,settingsDefaults,settingsSaveSchema,settingsId,settingsValues,settingsChangedFields,workOrderDeadline } from "../src/lib/system-settings-policy";
import type { User } from "../src/lib/domain";
const admin:User={_id:"admin",name:"ผู้ดูแล",username:"admin",role:"admin",grants:[{companyId:"A",siteId:"1"},{companyId:"B",siteId:"2"}]};
test("settings require admin and the exact company/site grant",()=>{
  assert.equal(canManageSettings(admin,{companyId:"A",siteId:"1"}),true);
  assert.equal(canManageSettings(admin,{companyId:"A",siteId:"2"}),false);
  assert.equal(canManageSettings({...admin,role:"supervisor"},{companyId:"A",siteId:"1"}),false);
  assert.equal(canManageSettings({...admin,grants:[]},{companyId:"A",siteId:"1"}),false);
});
test("settings validate identity and repair deadlines",()=>{
  const value={...settingsDefaults("บริษัททดสอบ","โรงงาน"),companyId:"A",siteId:"1",revision:0};
  assert.ok(settingsSaveSchema.safeParse(value).success);
  for(const patch of [{taxId:"123"},{email:"invalid"},{companyNameTh:" "},{vatRate:7},{urgentHours:0},{normalHours:1.5},{highHours:2,urgentHours:4},{normalHours:20,highHours:24},{revision:-1},{password:"must-not-be-saved"}]) {
    assert.equal(settingsSaveSchema.safeParse({...value,...patch}).success,false,JSON.stringify(patch));
  }
  assert.ok(settingsSaveSchema.safeParse({...value,taxId:"0107569000123",email:"test@example.com"}).success);
});
test("settings snapshot only includes known editable values and reports changed fields",()=>{
  const previous=settingsDefaults("บริษัททดสอบ","โรงงาน");
  const next=settingsValues({...previous,normalHours:96,passwordHash:"secret",revision:99},previous);
  assert.equal("passwordHash" in next,false);
  assert.equal("revision" in next,false);
  assert.deepEqual(settingsChangedFields(previous,next),["normalHours"]);
  assert.deepEqual(settingsChangedFields(previous,{...previous}),[]);
  assert.notEqual(settingsId("A:B","C"),settingsId("A","B:C"));
});
test("work orders use configured repair deadlines and preserve original defaults",()=>{
  const now=new Date("2026-10-14T07:00:00Z");
  assert.equal(workOrderDeadline("urgent",null,now).toISOString(),"2026-10-14T11:00:00.000Z");
  assert.equal(workOrderDeadline("high",null,now).toISOString(),"2026-10-15T07:00:00.000Z");
  assert.equal(workOrderDeadline("normal",null,now).toISOString(),"2026-10-17T07:00:00.000Z");
  assert.equal(workOrderDeadline("normal",{normalHours:48},now).toISOString(),"2026-10-16T07:00:00.000Z");
  assert.equal(workOrderDeadline("urgent",{urgentHours:2},now).toISOString(),"2026-10-14T09:00:00.000Z");
  for(const urgentHours of [0,8761,NaN,"invalid"])assert.equal(workOrderDeadline("urgent",{urgentHours},now).toISOString(),"2026-10-14T11:00:00.000Z");
  assert.equal(now.toISOString(),"2026-10-14T07:00:00.000Z");
});