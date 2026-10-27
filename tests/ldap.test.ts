import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { canSetupLdap,escapeLdapFilter,ldapConfigSchema,ldapLoginName,ldapTlsOptions,ldapConnectionSecurity } from "../src/lib/ldap-policy";
import { sealLdapSecret,openLdapSecret } from "../src/lib/ldap-secret";
import { authenticateLdap } from "../src/lib/ldap-client";
import { ldapFailure } from "../src/lib/ldap-errors";
test("LDAP diagnostics distinguish connection, credentials, certificates and database failures without exposing raw messages",()=>{
  for(const [error,stage,code] of [
    [{code:"ECONNRESET"},"ldap-connect-search","LDAP_CONNECTION_RESET"],
    [{code:"ENOTFOUND"},"ldap-connect-search","LDAP_DNS_ERROR"],
    [{name:"InvalidCredentialsError",code:49},"ldap-connect-search","LDAP_BIND_INVALID"],
    [{code:"SELF_SIGNED_CERT_IN_CHAIN"},"ldap-connect-search","LDAP_CERTIFICATE_ERROR"],
    [{name:"MongoServerError",code:86},"indexes","LDAP_INDEX_CONFLICT"],
  ] as const)assert.equal(ldapFailure(error,stage).code,code);
  const result=ldapFailure(new Error("private-password-and-server-details"),"save");
  assert.ok(!JSON.stringify(result).includes("private-password"));
});
const config={companyId:"A",revision:0,enabled:true,mode:"ldap",directory:"ad",url:"ldaps://dc.company.local:636",baseDn:"DC=company,DC=local",bindDn:"CN=reader,DC=company,DC=local",bindPassword:"test-service-password",filter:"(objectClass=user)",usernameAttribute:"sAMAccountName",nameAttribute:"displayName",emailAttribute:"mail",siteId:"1"};
test("plain LDAP requires an explicit choice and never downgrades an LDAPS URL",()=>{
  assert.equal(ldapConfigSchema.parse(config).ldapTransport,"starttls");
  assert.equal(ldapConnectionSecurity({url:"ldap://192.168.10.2:389"}),"starttls");
  assert.equal(ldapConnectionSecurity({url:"ldap://192.168.10.2:389",ldapTransport:"plain"}),"plain");
  assert.equal(ldapConnectionSecurity({url:"ldaps://dc.local:636",ldapTransport:"plain"}),"ldaps");
  assert.equal(ldapConfigSchema.safeParse({...config,ldapTransport:"fallback"}).success,false);
});
test("TLS verification defaults on for existing settings and can be disabled per company without dropping encryption",()=>{
  assert.equal(ldapConfigSchema.parse(config).verifyTlsCertificate,true);
  assert.equal(ldapTlsOptions({caCertificate:""}).rejectUnauthorized,true);
  const options=ldapTlsOptions({caCertificate:"ignored-test-ca",verifyTlsCertificate:false});
  assert.equal(options.rejectUnauthorized,false);
  assert.equal(options.minVersion,"TLSv1.2");
  assert.equal(options.ca,undefined);
  assert.equal(ldapTlsOptions({caCertificate:"test-ca",verifyTlsCertificate:true}).ca,"test-ca");
});
test("LDAP setup requires admin with access to every branch of the exact company",()=>{
  const actor={role:"admin" as const,grants:[{companyId:"A",siteId:"1"}]};
  assert.ok(canSetupLdap(actor,"A",[{_id:"1"}]));
  assert.equal(canSetupLdap(actor,"B",[{_id:"1"}]),false);
  assert.equal(canSetupLdap(actor,"A",[{_id:"1"},{_id:"2"}]),false);
  assert.equal(canSetupLdap({...actor,role:"supervisor"},"A",[{_id:"1"}]),false);
  assert.equal(canSetupLdap(actor,"A",[]),false);
});
test("LDAP config accepts TLS endpoints and rejects URL credentials and invalid attribute/filter inputs",()=>{
  assert.ok(ldapConfigSchema.safeParse(config).success);
  for(const url of ["http://dc.local","ldaps://user:password@dc.local","ldaps://dc.local/path","ldaps://dc.local?x=1"])
    assert.equal(ldapConfigSchema.safeParse({...config,url}).success,false);
  assert.ok(ldapConfigSchema.safeParse({...config,url:"ldap://dc.local:389"}).success);
  assert.equal(ldapConfigSchema.safeParse({...config,usernameAttribute:"uid)(objectClass=*"}).success,false);
  assert.equal(ldapConfigSchema.safeParse({...config,filter:"objectClass=user"}).success,false);
});
test("LDAP account naming uses the directory username and filter escaping blocks injected operators",()=>{
  assert.equal(ldapLoginName(" Somchai "),"somchai");
  assert.equal(ldapLoginName("same"),"same");
  assert.throws(()=>ldapLoginName("bad user"));
  assert.equal(escapeLdapFilter("a*)(uid=*)\\\0"),"a\\2a\\29\\28uid=\\2a\\29\\5c\\00");
});
test("LDAP service secrets use randomized authenticated encryption and reject tampering or absent keys",t=>{
  const previous=process.env.LDAP_ENCRYPTION_KEY;
  t.after(()=>{if(previous===undefined)delete process.env.LDAP_ENCRYPTION_KEY;else process.env.LDAP_ENCRYPTION_KEY=previous;});
  process.env.LDAP_ENCRYPTION_KEY=randomBytes(32).toString("hex");
  const one=sealLdapSecret("test-only-password"),two=sealLdapSecret("test-only-password");
  assert.notEqual(one,two);assert.ok(!one.includes("test-only-password"));assert.equal(openLdapSecret(one),"test-only-password");
  const parts=one.split(".");const bytes=Buffer.from(parts[2],"base64");bytes[0]^=1;parts[2]=bytes.toString("base64");assert.throws(()=>openLdapSecret(parts.join(".")));
  delete process.env.LDAP_ENCRYPTION_KEY;assert.throws(()=>sealLdapSecret("test"));
});
test("empty user passwords cannot invoke anonymous LDAP bind",async()=>{
  const parsed=ldapConfigSchema.parse(config),{bindPassword,...fields}=parsed;
  assert.equal(await authenticateLdap({...fields,secret:"unused"},"somchai",""),false);
});

test("LDAP profile attributes default to AD and validate custom mappings",()=>{
 const parsed=ldapConfigSchema.parse(config);
 assert.equal(parsed.departmentAttribute,"department");
 assert.equal(parsed.positionAttribute,"title");
 assert.equal(ldapConfigSchema.parse({...config,departmentAttribute:"ou"}).departmentAttribute,"ou");
 assert.equal(ldapConfigSchema.safeParse({...config,positionAttribute:"title)(uid=*"}).success,false);
});

test("LDAP settings always use CMMS passwords including legacy LDAP mode",()=>{
 assert.equal(ldapConfigSchema.parse(config).mode,"sync");
 assert.equal(ldapConfigSchema.parse({...config,mode:"sync"}).mode,"sync");
 const {mode,...withoutMode}=config;
 assert.equal(ldapConfigSchema.parse(withoutMode).mode,"sync");
});
