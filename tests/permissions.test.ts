import test from "node:test";
import assert from "node:assert/strict";
import { defaultPermissions, resolvePermissions, permitted, requestPermission, permissionChanges } from "../src/lib/permissions";
test("permission history identifies enabled and disabled rights without unchanged entries", () => {
  const before=defaultPermissions("supervisor"),after=structuredClone(before);
  after.assets.edit=false; after.assets.delete=false;
  const changes=permissionChanges(before,after);
  assert.equal(changes.length,2);
  assert.deepEqual(changes.map(x=>[x.module,x.action,x.from,x.to]),[["assets","edit",true,false],["assets","delete",true,false]]);
  assert.equal(changes[0].moduleLabel,"ทะเบียนเครื่องจักร");
  assert.equal(permissionChanges(before,before).length,0);
  assert.equal(permissionChanges().length,0);
  assert.ok(permissionChanges(after,before).every(x=>!x.from&&x.to));
});
test("role permissions preserve workflow boundaries and deny unsupported actions", () => {
  assert.equal(defaultPermissions("executive").assets.edit,false);
  assert.equal(defaultPermissions("supervisor").assets.delete,true);
  assert.equal(defaultPermissions("technician").workOrders.approve,false);
  assert.equal(defaultPermissions("admin").auditLogs.delete,false);
  const saved=defaultPermissions("requester"); saved.users.view=true;
  assert.equal(resolvePermissions("requester",saved).users.view,false);
});
test("saved denials take effect while missing policies preserve existing access", () => {
  const saved=defaultPermissions("supervisor"); saved.assets.edit=false;
  assert.equal(permitted({role:"supervisor",permissions:saved},"assets","edit"),false);
  assert.equal(permitted({role:"supervisor"},"assets","edit"),true);
  assert.equal(permitted({role:"admin"},"unknown"),false);
});
test("API permission classification distinguishes creation editing deletion and approval", async () => {
  const request=(path:string,body?:unknown)=>new Request(`https://cmms.example/api/${path}`,body?{method:"POST",body:JSON.stringify(body)}:{});
  for(const [path,body,module,action] of [
    ["assets",{},"assets","create"], ["assets/123",{},"assets","edit"],
    ["assets/123/delete",{},"assets","delete"], ["masters",{kind:"locations",action:"delete",id:"123"},"locations","delete"],
    ["workOrders/123/transition",{next:"completed"},"workOrders","approve"],
    ["masters?kind=sites",undefined,"sites","view"], ["admin-users/password",{id:"123"},"users","edit"],
    ["smtp-settings",undefined,"smtp","view"], ["smtp-settings",{action:"save"},"smtp","edit"],
    ["smtp-settings",{action:"test"},"smtp","edit"],
    ["ldap-settings",undefined,"ldap","view"], ["ldap-settings",{action:"save"},"ldap","edit"],
    ["ldap-settings",{action:"sync"},"ldap","edit"],
  ] as const) assert.deepEqual(await requestPermission(request(path,body)),{module,action});
  const req=request("assets",{name:"test"}); await requestPermission(req); assert.equal((await req.json()).name,"test");
  assert.equal(await requestPermission(request("me")),null);
});

test("LDAP and SMTP support only admin view and edit, with independent saved permissions",()=>{
  for(const role of ["admin","supervisor","executive","technician","requester"] as const) {
    const matrix=defaultPermissions(role);
    for(const module of ["ldap","smtp"]) {
      assert.equal(matrix[module].view,role==="admin");
      assert.equal(matrix[module].edit,role==="admin");
      for(const action of ["create","delete","approve"] as const)assert.equal(matrix[module][action],false);
    }
  }
  const saved=defaultPermissions("admin");
  saved.smtp.edit=false;saved.settings.view=false;saved.settings.edit=false;
  assert.equal(permitted({role:"admin",permissions:saved},"smtp","edit"),false);
  assert.equal(permitted({role:"admin",permissions:saved},"smtp","view"),true);
  assert.equal(permitted({role:"admin",permissions:saved},"ldap","edit"),true);
});
test("legacy settings denials carry over to the new LDAP and SMTP modules until saved separately",()=>{
  const legacy=defaultPermissions("admin");delete legacy.ldap;delete legacy.smtp;
  legacy.settings.edit=false;
  const resolved=resolvePermissions("admin",legacy);
  assert.equal(resolved.ldap.view,true);assert.equal(resolved.ldap.edit,false);
  assert.equal(resolved.smtp.view,true);assert.equal(resolved.smtp.edit,false);
  legacy.settings.view=false;
  assert.equal(resolvePermissions("admin",legacy).smtp.view,false);
  assert.equal(resolvePermissions("admin",legacy).ldap.view,false);
  assert.deepEqual(resolvePermissions("admin",resolved),resolved);
});
