import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPermissions, permitted, requestPermission } from '../src/lib/permissions';
import { visibleNotifications } from '../src/lib/notification-inbox';
import { auditModule, auditDescription } from '../src/lib/audit-display';
import type { User } from '../src/lib/domain';

test('PM enforces saved rights and role boundaries', async()=>{
 for(const role of ['admin','supervisor','technician','executive','requester'] as const){
  assert.equal(permitted({role},'pm'),role!=='requester');
  assert.equal(permitted({role},'pm','create'),['admin','supervisor'].includes(role));
  assert.equal(permitted({role},'pm','edit'),['admin','supervisor','technician'].includes(role));
 }
 const permissions=defaultPermissions('supervisor');permissions.pm.create=false;
 assert.equal(permitted({role:'supervisor',permissions},'pm','create'),false);
 for(const [action,right] of [['create','create'],['generate','create'],['toggle','edit'],['complete','edit']]){
  assert.deepEqual(await requestPermission(new Request('https://cmms.test/api/pm',{method:'POST',body:JSON.stringify({action})})),{module:'pm',action:right});
 }
});

test('PM notifications resolve current assignment and hide revoked or missing jobs', async()=>{
 const actor:User={_id:'tech',name:'Tech',username:'tech',role:'technician',grants:[{companyId:'a',siteId:'1'}]};
 let assigneeId='tech',exists=true;
 const d={collection(name:string){return {
  find(){return {sort(){return {async toArray(){return [{_id:'n',module:'pm',entityId:'job',companyId:'a',siteId:'1',message:'PM due'}];}};}};},
  async findOne(filter:any){assert.equal(name,'pmOccurrences');assert.deepEqual(filter.$or,actor.grants);return exists?{_id:'job',companyId:'a',siteId:'1',assigneeId}:null;}
 };}} as unknown as Parameters<typeof visibleNotifications>[0];
 assert.equal((await visibleNotifications(d,actor)).length,1);
 assigneeId='other';assert.equal((await visibleNotifications(d,actor)).length,0);
 assigneeId='tech';const permissions=defaultPermissions('technician');permissions.pm.view=false;
 assert.equal((await visibleNotifications(d,{...actor,permissions})).length,0);
 exists=false;assert.equal((await visibleNotifications(d,actor)).length,0);
});

test('PM audit events use PM module and readable descriptions',()=>{
 for(const event of ['pm.plan.created','pm.plan.toggled','pm.completed'])assert.equal(auditModule(event),'pm');
 assert.match(auditDescription('pm.completed','pm','Pump inspection'),/Pump inspection/);
 assert.ok(!auditDescription('pm.completed','pm','Pump inspection').includes('pm.completed'));
});
