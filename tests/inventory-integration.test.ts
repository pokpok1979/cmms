import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPermissions, permitted, requestPermission } from '../src/lib/permissions';
import { requireInventory } from '../src/lib/inventory-service';
import { auditModule } from '../src/lib/audit-display';
test('inventory rejects requester and saved view denials',()=>{
  assert.equal(permitted({role:'requester'},'inventory'),false);
  assert.equal(permitted({role:'executive'},'inventory','edit'),false);
  const permissions=defaultPermissions('supervisor'); permissions.inventory.view=false;
  assert.throws(()=>requireInventory({_id:'u',name:'U',username:'u',role:'supervisor',grants:[],permissions}));
  assert.equal(auditModule('inventory.issue'),'inventory');
});
test('inventory API distinguishes master creation and movement editing',async()=>{
  for(const [body,action] of [[{action:'save'},'create'],[{action:'save',id:'p'},'edit'],[{action:'move'},'edit']] as const)
    assert.deepEqual(await requestPermission(new Request('http://localhost/api/inventory',{method:'POST',body:JSON.stringify(body)})),{module:'inventory',action});
});
