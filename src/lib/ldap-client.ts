import { Client, type Entry } from "ldapts";
import { openLdapSecret } from "./ldap-secret";
import { escapeLdapFilter,ldapTlsOptions,ldapConnectionSecurity,type LdapConfig } from "./ldap-policy";
export type StoredLdapConfig=Omit<LdapConfig,"bindPassword"> & {secret:string};
function value(entry:Entry,attribute:string){const key=Object.keys(entry).find(key=>key.toLowerCase()===attribute.toLowerCase());const raw=key?entry[key]:"";return String(Array.isArray(raw)?raw[0]||"":raw||"");}
async function connect(config:StoredLdapConfig){
  const tls=ldapTlsOptions(config);
  const security=ldapConnectionSecurity(config);
  const client=new Client({url:config.url,timeout:15000,connectTimeout:10000,...(security==="ldaps"?{tlsOptions:tls}:{})});
  try{if(security==="starttls")await client.startTLS(tls);await client.bind(config.bindDn,openLdapSecret(config.secret));return client;}
  catch(error){await client.unbind().catch(()=>{});throw error;}
}
export async function readLdap(config:StoredLdapConfig,account?:string){
  const client=await connect(config);
  try{
    const {searchEntries}=await client.search(config.baseDn,{scope:"sub",filter:account?`(&${config.filter}(${config.usernameAttribute}=${escapeLdapFilter(account)}))`:config.filter,
      attributes:[config.usernameAttribute,config.nameAttribute,config.emailAttribute,config.departmentAttribute||"department",config.positionAttribute||"title"],sizeLimit:account?2:2000,paged:account?false:{pageSize:200}});
    return searchEntries.map(entry=>({dn:entry.dn,department:value(entry,config.departmentAttribute||"department").trim(),position:value(entry,config.positionAttribute||"title").trim(),account:value(entry,config.usernameAttribute),name:value(entry,config.nameAttribute),email:value(entry,config.emailAttribute).trim().toLowerCase()}));
  }finally{await client.unbind().catch(()=>{});}
}
export async function authenticateLdap(config:StoredLdapConfig,account:string,password:string){
  if(!password||!account)return false;
  const matches=await readLdap(config,account);if(matches.length!==1)return false;
  const client=await connect(config);
  try{await client.bind(matches[0].dn,password);return true;}catch{return false;}finally{await client.unbind().catch(()=>{});}
}
