import test from 'node:test';
import assert from 'node:assert/strict';
import {assetScopeChange} from '../src/lib/assets-policy';
import {defaultPermissions} from '../src/lib/permissions';
import type {User} from '../src/lib/domain';
const a={companyId:'A',siteId:'1'},b={companyId:'B',siteId:'2'};
const actor:User={_id:'admin',name:'Admin',username:'admin',role:'admin',grants:[a,b]};
test('asset company changes require source and destination scope and edit permission',()=>{
 assert.equal(assetScopeChange(actor,a,b,false),null);
 assert.equal(assetScopeChange({...actor,grants:[a]},a,b,false),'forbidden');
 assert.equal(assetScopeChange({...actor,grants:[b]},a,b,false),'forbidden');
 assert.equal(assetScopeChange(actor,a,{companyId:'A',siteId:'2'},false),'forbidden');
 assert.equal(assetScopeChange({...actor,role:'technician'},a,b,false),'forbidden');
 const permissions=defaultPermissions('admin');permissions.assets.edit=false;
 assert.equal(assetScopeChange({...actor,permissions},a,b,false),'forbidden');
});
test('asset history blocks scope transfers but permits ordinary edits',()=>{
 assert.equal(assetScopeChange(actor,a,b,true),'has-history');
 assert.equal(assetScopeChange(actor,a,a,true),null);
 assert.equal(assetScopeChange({...actor,role:'supervisor'},a,b,false),null);
});
