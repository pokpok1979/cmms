import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPermission,defaultPermissions } from '../src/lib/permissions';
import { canRecordPM,canSeePM,canCreateDefect,requirePMAccess } from '../src/lib/pm3-policy';
import type {User} from '../src/lib/domain';
const actor:User={_id:'t',name:'T',username:'t',role:'technician',grants:[{companyId:'A',siteId:'1'}]};
test('Phase 3 APIs map save, generate, photos and defect to existing PM rights',async()=>{
 for(const [action,id,right] of [['save',undefined,'create'],['save','plan','edit'],['generate',undefined,'create'],['toggle','plan','edit'],['complete','job','edit'],['defect','job','edit']]){
  const req=new Request('https://cmms.test/api/pm3',{method:'POST',body:JSON.stringify({action,id})});
  assert.deepEqual(await requestPermission(req),{module:'pm',action:right});
  assert.equal((await req.json()).action,action);
 }
 assert.deepEqual(await requestPermission(new Request('https://cmms.test/api/pm3?mode=export')),{module:'pm',action:'view'});
 const upload=new Request('https://cmms.test/api/pm3/photos',{method:'POST',body:'multipart payload',headers:{'Content-Type':'multipart/form-data; boundary=example'}});
 assert.deepEqual(await requestPermission(upload),{module:'pm',action:'edit'});
 assert.equal(await upload.text(),'multipart payload');
});
test('PM completion and defect creation honor saved module rights',()=>{
 const job={assigneeId:'t',status:'pending'};
 assert.equal(canRecordPM(actor,job),true);
 assert.equal(canCreateDefect(actor),true);
 const permissions=defaultPermissions('technician');permissions.pm.edit=false;
 const denied={...actor,permissions};
 assert.equal(canRecordPM(denied,job),false);
 assert.equal(canCreateDefect(denied),false);
 assert.throws(()=>requirePMAccess(denied,'edit'));
 permissions.pm.edit=true;permissions.repairRequests.create=false;
 assert.equal(canCreateDefect({...actor,permissions}),false);
 permissions.pm.view=false;
 assert.equal(canSeePM({...actor,permissions},job),false);
 assert.throws(()=>requirePMAccess({...actor,permissions}));
 assert.equal(canSeePM({...actor,role:'requester'},job),false);
});
