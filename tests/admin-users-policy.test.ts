import test from "node:test";
import assert from "node:assert/strict";
import {canManageUser, escapeUserSearch, normalizeEmail} from "../src/lib/admin-users-policy";
const actor={role:"admin" as const,grants:[{companyId:"A",siteId:"1"},{companyId:"B",siteId:"2"}]};
test("admin cannot manage a cross-company/site pair or a partially visible account",()=>{
 assert.equal(canManageUser(actor,[{companyId:"A",siteId:"2"}]),false);
 assert.equal(canManageUser(actor,[{companyId:"A",siteId:"1"},{companyId:"C",siteId:"3"}]),false);
 assert.equal(canManageUser(actor,[{companyId:"A",siteId:"1"},{companyId:"B",siteId:"2"}]),true);
});
test("non-admin and empty grants cannot manage accounts",()=>{
 assert.equal(canManageUser({...actor,role:"supervisor"},actor.grants),false);
 assert.equal(canManageUser(actor,[]),false);
 assert.equal(canManageUser({...actor,grants:[]},[{companyId:"A",siteId:"1"}]),false);
});
test("search treats regex metacharacters as literal input",()=>{
 const q="Pok.(IT)+[1]$";const matcher=new RegExp(escapeUserSearch(q),"i");
 assert.equal(matcher.test("pok.(it)+[1]$"),true);
 assert.equal(matcher.test("PokXIT111"),false);
});
test("emails have one normalized form for case-insensitive duplicate checking",()=>{
 assert.equal(normalizeEmail(" Pok@AGEt.co.th "),normalizeEmail("pok@aget.co.th"));
});
