export function smtpFailure(error: unknown) {
  const e = error as { name?: string; code?: string; originalCode?: string; message?: string; responseCode?: number; command?: string } | null;
  const codes = [e?.code, e?.originalCode].filter((code): code is string => typeof code === "string");
  const has = (...values: string[]) => codes.some(code => values.includes(code));
  const result = (status: number, code: string, message: string) => ({ status, code, message });
  if (e?.name?.startsWith("Mongo")) return result(503, "SMTP_DATABASE_ERROR", "เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบ MongoDB ก่อนทดสอบ SMTP");
  if (/encryption key|authenticate data|authentication tag|bad decrypt/i.test(e?.message || ""))
    return result(503, "SMTP_SECRET_ERROR", "ถอดรหัสรหัสผ่าน SMTP ไม่สำเร็จ ตรวจ SMTP_ENCRYPTION_KEY หรือ LDAP_ENCRYPTION_KEY ให้ตรงกับตอนบันทึก แล้วกรอกรหัสผ่าน SMTP และบันทึกใหม่");
  if (/email is not configured|SMTP password is not configured/.test(e?.message || ""))
    return result(422, "SMTP_NOT_CONFIGURED", "กรุณาบันทึกการตั้งค่า SMTP เปิดใช้งานการส่งอีเมล และระบุรหัสผ่านหากต้องยืนยันตัวตน");
  if (has("EAUTH", "ENOAUTH", "EOAUTH2")) return result(422, "SMTP_AUTH_ERROR", "SMTP ปฏิเสธการยืนยันตัวตน ตรวจบัญชี รหัสผ่าน และนโยบาย SMTP AUTH ของผู้ให้บริการ");
  if (has("EDNS", "ENOTFOUND", "EAI_AGAIN")) return result(502, "SMTP_DNS_ERROR", "ค้นหา SMTP Server ไม่สำเร็จ ตรวจชื่อเซิร์ฟเวอร์และ DNS ของเครื่องที่รัน API");
  if (has("ETIMEDOUT")) return result(504, "SMTP_TIMEOUT", "SMTP ไม่ตอบกลับภายในเวลาที่กำหนด ตรวจพอร์ต Firewall และการจับคู่ TLS 465 หรือ StartTLS 587 ตามผู้ให้บริการ");
  if (has("CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_TLS_CERT_ALTNAME_INVALID"))
    return result(502, "SMTP_CERTIFICATE_ERROR", "ตรวจสอบใบรับรอง SMTP ไม่ผ่าน ให้ตรวจวันหมดอายุ ชื่อเซิร์ฟเวอร์ และ CA Certificate บนเครื่องที่รัน API");
  if (has("ETLS", "EPROTO", "EREQUIRETLS") || codes.some(code => code.startsWith("ERR_SSL") || code.startsWith("ERR_TLS")) || /wrong version number|tlsv1 alert|ssl routines/i.test(e?.message || ""))
    return result(502, "SMTP_TLS_ERROR", "เริ่ม TLS ไม่สำเร็จ ตรวจรูปแบบการเข้ารหัสและพอร์ตของ SMTP Server: TLS 465 หรือ StartTLS 587 ตามผู้ให้บริการ");
  if (has("ECONNREFUSED", "ECONNECTION", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "ESOCKET"))
    return result(502, "SMTP_CONNECTION_ERROR", "เชื่อมต่อ SMTP ไม่สำเร็จหรือถูกตัด ตรวจ SMTP Server พอร์ต Firewall และเครือข่ายจากเครื่องที่รัน API");
  return result(500, "SMTP_OPERATION_FAILED", "ดำเนินการ SMTP ไม่สำเร็จ กรุณาแจ้งรหัสอ้างอิงและขั้นตอนที่เกิดปัญหาให้ผู้ดูแลระบบ");
}
