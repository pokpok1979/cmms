import test from "node:test";
import assert from "node:assert/strict";
import type { Role } from "../src/lib/domain";
import { labels } from "../src/lib/domain";
import { guideCanOpen,guideCanUseStep,guideFlows } from "../src/lib/guide-data";
const roles:Role[]=["admin","supervisor","technician","requester","executive"];
test("every signed-in role can open the guide and common read screens",()=>{
  for(const role of roles){
    assert.equal(guideCanOpen(role,"guide"),true);
    for(const view of ["dashboard","repairRequests","workOrders","assets","notifications","profile"])assert.equal(guideCanOpen(role,view),true);
    assert.equal(guideCanOpen(role,"unknown"),false);
  }
});
test("guide links preserve admin and manager restrictions",()=>{
  for(const role of roles){
    for(const view of ["users","smtp","auditLogs","settings","workTypes","companies","sites"])assert.equal(guideCanOpen(role,view),role==="admin");
    assert.equal(guideCanOpen(role,"locations"),role==="admin");
    assert.equal(guideCanOpen(role,"new"),role!=="executive");
  }
});
test("process steps respect workflow actions even when their list is readable",()=>{
  const flow=guideFlows.find(flow=>flow.id==="repair")!;
  const approve=flow.steps[1],repair=flow.steps[3],review=flow.steps[4],close=flow.steps[5];
  assert.equal(guideCanUseStep("requester",approve),false);
  assert.equal(guideCanUseStep("supervisor",approve),true);
  assert.equal(guideCanUseStep("technician",repair),true);
  assert.equal(guideCanUseStep("admin",repair),false);
  assert.equal(guideCanUseStep("technician",review),false);
  assert.equal(guideCanUseStep("admin",review),true);
  assert.equal(guideCanUseStep("requester",close),true);
  assert.equal(guideCanUseStep("executive",close),false);
  for(const flow of guideFlows)for(const step of flow.steps)if(step.filter)assert.ok(labels[step.filter],step.filter);
});
test('PM guide covers all roles, live modules and saved denials',async()=>{
 const {guideLinkAllowed,guideModules,guidePMDetails}=await import('../src/lib/guide-data');
 const {defaultPermissions}=await import('../src/lib/permissions');
 for(const role of roles){
  const user={_id:role,name:role,username:role,role,grants:[]};
  assert.equal(guideLinkAllowed(user,'pm'),role!=='requester');
  assert.equal(guideLinkAllowed(user,'pm','create'),role==='admin'||role==='supervisor');
  assert.equal(guideLinkAllowed(user,'pm','edit'),['admin','supervisor','technician'].includes(role));
 }
 const permissions=defaultPermissions('supervisor');permissions.pm.view=false;
 assert.equal(guideLinkAllowed({_id:'s',name:'s',username:'s',role:'supervisor',grants:[],permissions},'pm'),false);
 for(const view of ['pm','assets','roles','ldap','smtp','notifications','auditLogs'])assert.ok(guideModules.some(module=>module.view===view));
 assert.equal(new Set(guideModules.map(module=>module.view)).size,guideModules.length);
 assert.ok(guidePMDetails.length>=6);
 const pm=guideFlows.find(flow=>flow.id==='pm')!;
 assert.ok(pm);
 assert.equal(guideCanUseStep('technician',pm.steps[0]),false);
 assert.equal(guideCanUseStep('technician',pm.steps[2]),true);
 assert.equal(guideCanUseStep('admin',pm.steps[2]),false);
 const transfer=guideFlows.find(flow=>flow.id==='assets')!.steps.find(step=>step.action==='edit')!;
 assert.ok(transfer);
 assert.equal(guideCanUseStep('requester',transfer),false);
 assert.equal(guideCanUseStep('supervisor',transfer),true);
});
