import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { canManageSmtp,smtpSchema,smtpDefaults,publicSmtpSettings,recoveryCompany } from "../src/lib/smtp-policy";
import { sealSmtpSecret,openSmtpSecret,smtpEncryptionReady } from "../src/lib/smtp-secret";

const config={...smtpDefaults,companyId:"A",host:"smtp.company.local",fromEmail:"no-reply@company.com",appUrl:"https://cmms.company.com",username:"reader"};
test("SMTP settings require explicit secure transport and validate sender, host, port and public URL",()=>{
  assert.ok(smtpSchema.safeParse(config).success);
  for(const invalid of [{host:"smtp://server:587"},{host:"server\r\nHEADER"},{port:0},{port:65536},{security:"plain"},{fromEmail:"not-email"},{fromName:"CMMS\r\nBcc:other@example.com"},{appUrl:"javascript:alert(1)"},{appUrl:"https://user:secret@cmms.company.com"},{appUrl:"https://cmms.company.com?token=secret"},{username:""}])
    assert.equal(smtpSchema.safeParse({...config,...invalid}).success,false);
  assert.ok(smtpSchema.safeParse({...config,authEnabled:false,username:""}).success);
});
test("SMTP management requires administrator access to every branch in the exact company",()=>{
  const actor={role:"admin" as const,grants:[{companyId:"A",siteId:"1"}]};
  const sites=[{_id:"1",companyId:"A"}];
  assert.equal(canManageSmtp(actor,"A",sites),true);
  assert.equal(canManageSmtp({...actor,role:"requester"},"A",sites),false);
  assert.equal(canManageSmtp(actor,"A",[...sites,{_id:"2",companyId:"A"}]),false);
  assert.equal(canManageSmtp(actor,"B",[{_id:"1",companyId:"B"}]),false);
  assert.equal(canManageSmtp(actor,"A",[]),false);
});
test("public SMTP responses never include plaintext passwords or encrypted secrets",()=>{
  const publicConfig=publicSmtpSettings({...config,password:"private-password",secret:"encrypted-secret",internalField:"private"});
  assert.equal(publicConfig.hasPassword,true);
  assert.equal(publicConfig.host,config.host);
  for(const value of ["private-password","encrypted-secret","private"])assert.ok(!JSON.stringify(publicConfig).includes(value));
  assert.equal("password" in publicConfig,false);
  assert.equal("secret" in publicConfig,false);
});
test("password recovery selects the linked LDAP company only when it is still granted",()=>{
  const grants=[{companyId:"A"},{companyId:"B"}];
  assert.equal(recoveryCompany({ldapCompanyId:"B",grants}),"B");
  assert.equal(recoveryCompany({ldapCompanyId:"removed",grants}),"A");
  assert.equal(recoveryCompany({grants}),"A");
  assert.equal(recoveryCompany({}),undefined);
});
test("SMTP credentials use authenticated randomized encryption and support the existing server key",t=>{
  const smtp=process.env.SMTP_ENCRYPTION_KEY,ldap=process.env.LDAP_ENCRYPTION_KEY;
  t.after(()=>{if(smtp===undefined)delete process.env.SMTP_ENCRYPTION_KEY;else process.env.SMTP_ENCRYPTION_KEY=smtp;if(ldap===undefined)delete process.env.LDAP_ENCRYPTION_KEY;else process.env.LDAP_ENCRYPTION_KEY=ldap;});
  delete process.env.SMTP_ENCRYPTION_KEY;delete process.env.LDAP_ENCRYPTION_KEY;
  assert.equal(smtpEncryptionReady(),false);assert.throws(()=>sealSmtpSecret("test-password"));
  process.env.LDAP_ENCRYPTION_KEY=randomBytes(32).toString("hex");
  assert.equal(smtpEncryptionReady(),true);
  const first=sealSmtpSecret("test-password"),second=sealSmtpSecret("test-password");
  assert.notEqual(first,second);assert.equal(openSmtpSecret(first),"test-password");assert.ok(!first.includes("test-password"));
  const parts=first.split("."),bytes=Buffer.from(parts[2],"base64");bytes[0]^=1;parts[2]=bytes.toString("base64");
  assert.throws(()=>openSmtpSecret(parts.join(".")));
  process.env.SMTP_ENCRYPTION_KEY=randomBytes(32).toString("hex");
  assert.equal(openSmtpSecret(first),"test-password");
  assert.throws(()=>openSmtpSecret(parts.join(".")));
  assert.equal(openSmtpSecret(sealSmtpSecret("dedicated-key")),"dedicated-key");
  process.env.LDAP_ENCRYPTION_KEY=randomBytes(32).toString("hex");
  assert.throws(()=>openSmtpSecret(first));
});
