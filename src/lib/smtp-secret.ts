import { createCipheriv,createDecipheriv,randomBytes } from "node:crypto";
function key() {
  const value=process.env.SMTP_ENCRYPTION_KEY || process.env.LDAP_ENCRYPTION_KEY || "";
  if(!/^[a-f0-9]{64}$/i.test(value))throw Error("SMTP encryption key is not configured");
  return Buffer.from(value,"hex");
}
export function smtpEncryptionReady() {try{key();return true;}catch{return false;}}
export function sealSmtpSecret(value:string) {
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv);
  cipher.setAAD(Buffer.from("cmms:smtp"));
  const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return [iv,cipher.getAuthTag(),encrypted].map(x=>x.toString("base64")).join(".");
}
export function openSmtpSecret(value:string) {
  const [iv,tag,encrypted]=value.split(".").map(x=>Buffer.from(x,"base64"));
  function decrypt(secretKey:Buffer) {
    const cipher=createDecipheriv("aes-256-gcm",secretKey,iv);
    cipher.setAAD(Buffer.from("cmms:smtp"));cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(encrypted),cipher.final()]).toString("utf8");
  }
  const primary=key();
  try { return decrypt(primary); }
  catch(error) {
    // Existing SMTP records may predate the dedicated SMTP encryption key.
    const legacy=process.env.LDAP_ENCRYPTION_KEY || "";
    if(process.env.SMTP_ENCRYPTION_KEY && /^[a-f0-9]{64}$/i.test(legacy) && !primary.equals(Buffer.from(legacy,"hex"))) {
      try { return decrypt(Buffer.from(legacy,"hex")); } catch { /* Preserve original failure. */ }
    }
    throw error;
  }
}
