import test from "node:test";
import assert from "node:assert/strict";
import { issueResetToken, hashResetToken, resetUrl, recoveryRequestSchema, passwordResetSchema } from "../src/lib/password-recovery-policy";
import { finishPasswordReset } from "../src/lib/password-recovery";
import { hashPassword, verify, ApiError } from "../src/lib/auth";
import type { Db } from "mongodb";

test("recovery tokens are random, hashed for storage and expire after fifteen minutes",()=>{
  const now = new Date("2026-10-15T00:00:00Z"), first=issueResetToken(now), second=issueResetToken(now);
  assert.notEqual(first.token,second.token);
  assert.match(first.token,/^[a-f0-9]{64}$/);
  assert.notEqual(first.hash,first.token);
  assert.equal(first.hash,hashResetToken(first.token));
  assert.equal(first.expiresAt.getTime()-now.getTime(),900000);
});
test("recovery links stay on the configured origin and keep tokens out of request URLs",()=>{
  const token=issueResetToken().token, url=new URL(resetUrl("https://cmms.example/internal?other=value",token));
  assert.equal(url.origin,"https://cmms.example");
  assert.equal(url.pathname,"/reset-password");
  assert.equal(url.search,"");
  assert.equal(new URLSearchParams(url.hash.slice(1)).get("token"),token);
  assert.throws(()=>resetUrl("javascript:alert(1)",token));
  assert.throws(()=>resetUrl("https://user:password@cmms.example",token));
});
test("password recovery normalizes email and rejects malformed requests",()=>{
  assert.equal(recoveryRequestSchema.parse({email:" User@Company.com "}).email,"user@company.com");
  for(const email of ["", "username", "test@example.com\r\nBcc: other@example.com"])
    assert.equal(recoveryRequestSchema.safeParse({email}).success,false);
});
test("password resets require a well formed token, matching passwords and the existing minimum length",()=>{
  const good={token:issueResetToken().token,password:"Only-A-Test-Password",confirmPassword:"Only-A-Test-Password"};
  assert.ok(passwordResetSchema.safeParse(good).success);
  for(const change of [{token:""},{token:"z".repeat(64)},{password:"short",confirmPassword:"short"},{confirmPassword:"Different-Password"}])
    assert.equal(passwordResetSchema.safeParse({...good,...change}).success,false);
});

function fixture() {
  const now=new Date(), issued=issueResetToken(now);
  const account={_id:"u1",email:"user@example.com",active:true,passwordHash:hashPassword("Previous-Password")};
  const tokens=[{_id:issued.hash,userId:account._id,email:account.email,credentialHash:account.passwordHash,expiresAt:issued.expiresAt},
    {_id:issueResetToken().hash,userId:account._id,email:account.email,credentialHash:account.passwordHash,expiresAt:issued.expiresAt}];
  const sessions=[{userId:"u1"},{userId:"u1"},{userId:"other"}];
  const database={collection:(name:string)=>({
    async findOneAndDelete(query:{_id:string;expiresAt:{$gt:Date}}) {
      const index=tokens.findIndex(t=>t._id===query._id && t.expiresAt>query.expiresAt.$gt);
      return index<0 ? null : tokens.splice(index,1)[0];
    },
    async findOne(query:{_id:string;active:boolean}) {return account._id===query._id && account.active===query.active ? {...account} : null;},
    async updateOne(_query:unknown,update:{$set:object}) {Object.assign(account,update.$set);},
    async deleteMany(query:{userId:string}) {
      const items=name==="sessions"?sessions:tokens;
      for(let i=items.length-1;i>=0;i--)if(items[i].userId===query.userId)items.splice(i,1);
    },
  })} as unknown as Db;
  return {database,now,issued,account,tokens,sessions};
}
test("successful recovery changes the password, revokes all user sessions and consumes every outstanding link",async()=>{
  const f=fixture(), password="Replacement-Password";
  await finishPasswordReset(f.database,undefined,f.issued.token,hashPassword(password),f.now);
  assert.ok(verify(password,f.account.passwordHash));
  assert.equal(verify("Previous-Password",f.account.passwordHash),false);
  assert.deepEqual(f.sessions,[{userId:"other"}]);
  assert.equal(f.tokens.length,0);
  await assert.rejects(finishPasswordReset(f.database,undefined,f.issued.token,hashPassword(password),f.now),ApiError);
});
test("expired links, suspended accounts and credentials changed by an admin cannot reset a password",async()=>{
  for(const reason of ["expired","suspended","password-changed","email-changed","unknown-token"]) {
    const f=fixture();
    if(reason==="expired")f.tokens[0].expiresAt=f.now;
    if(reason==="suspended")f.account.active=false;
    if(reason==="password-changed")f.account.passwordHash=hashPassword("Admin-Changed-Password");
    if(reason==="email-changed")f.account.email="different@example.com";
    const expected=f.account.passwordHash;
    await assert.rejects(finishPasswordReset(f.database,undefined,reason==="unknown-token"?issueResetToken().token:f.issued.token,"new-hash",f.now),ApiError);
    assert.equal(f.account.passwordHash,expected);
    assert.equal(f.sessions.length,3);
  }
});
