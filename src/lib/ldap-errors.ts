export function ldapFailure(error: unknown, stage: string) {
  const e = error as { name?: string; code?: string | number; message?: string } | null;
  const code = String(e?.code || ""), name = e?.name || "";
  const result = (status:number,code:string,message:string) => ({status,code,message});
  if (stage === "indexes" || name.startsWith("Mongo")) {
    if (code === "11000") return result(409,"LDAP_DUPLICATE","พบรหัสนำหน้าบริษัทหรือบัญชีซ้ำในฐานข้อมูล กรุณาตรวจสอบข้อมูลเดิม");
    if (["85","86"].includes(code)) return result(409,"LDAP_INDEX_CONFLICT","ดัชนีฐานข้อมูล LDAP มีรูปแบบต่างจากที่ระบบต้องการ กรุณาให้ผู้ดูแลตรวจสอบดัชนี (ไม่มีการลบดัชนีอัตโนมัติ)");
    if (code === "13") return result(500,"LDAP_DATABASE_PERMISSION","บัญชีฐานข้อมูลไม่มีสิทธิ์สร้างดัชนีหรือบันทึกข้อมูล LDAP");
    return result(500,"LDAP_DATABASE_ERROR","ฐานข้อมูลดำเนินการตั้งค่า LDAP ไม่สำเร็จ กรุณาแจ้งรหัสอ้างอิงให้ผู้ดูแลตรวจสอบ");
  }
  if (code === "LDAP_SECRET_ERROR" || /LDAP_ENCRYPTION_KEY|authenticate data|Invalid authentication tag/i.test(e?.message || ""))
    return result(503,"LDAP_SECRET_ERROR","ถอดรหัส Service Account ไม่สำเร็จ ตรวจ LDAP_ENCRYPTION_KEY และกรอกรหัสผ่าน Service Account แล้วบันทึกใหม่");
  if (name === "InvalidCredentialsError") return result(422,"LDAP_BIND_INVALID","AD ปฏิเสธบัญชีเชื่อมต่อ ตรวจ Bind DN/UPN และรหัสผ่าน รวมถึงบัญชีถูกล็อก หมดอายุ หรือถูกระงับหรือไม่");
  if (name === "NoSuchObjectError") return result(422,"LDAP_BASE_DN_INVALID","ไม่พบ Base DN ใน AD กรุณาตรวจชื่อ OU และ DC ให้ตรงกับเซิร์ฟเวอร์ที่เชื่อมต่อ");
  if (name === "InvalidDNSyntaxError") return result(422,"LDAP_DN_INVALID","รูปแบบ Bind DN หรือ Base DN ไม่ถูกต้อง");
  if (name === "InsufficientAccessError") return result(422,"LDAP_READ_DENIED","Service Account ไม่มีสิทธิ์อ่านรายชื่อใน Base DN ที่เลือก");
  if (name === "SizeLimitExceededError") return result(422,"LDAP_SEARCH_LIMIT","ผลค้นหาเกินขีดจำกัด กรุณาจำกัด Base DN หรือตัวกรองให้แคบลง");
  if (["ENOTFOUND","EAI_AGAIN"].includes(code)) return result(502,"LDAP_DNS_ERROR","เซิร์ฟเวอร์ CMMS หา IP ของ LDAP Server ไม่พบ กรุณาตรวจชื่อเครื่องและ DNS ภายในบริษัท");
  if (code === "ECONNREFUSED") return result(502,"LDAP_CONNECTION_REFUSED","LDAP Server ปฏิเสธการเชื่อมต่อ ตรวจ Host/Port และการเปิดใช้ LDAPS หรือ StartTLS");
  if (code === "ECONNRESET") return result(502,"LDAP_CONNECTION_RESET","การเชื่อมต่อถูกตัดโดยเซิร์ฟเวอร์หรืออุปกรณ์เครือข่าย (ECONNRESET) ตรวจบริการ LDAPS, TLS และ Firewall/VPN ระหว่าง CMMS กับ AD");
  if (["ETIMEDOUT","EHOSTUNREACH","ENETUNREACH"].includes(code) || /timeout/i.test(name+" "+(e?.message||""))) return result(504,"LDAP_TIMEOUT","ติดต่อ LDAP Server ไม่ได้ภายในเวลาที่กำหนด ตรวจเครือข่าย VPN และ Firewall จากเครื่องเซิร์ฟเวอร์ CMMS");
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ISSUER/.test(code)) return result(502,"LDAP_CERTIFICATE_ERROR","ตรวจสอบใบรับรอง LDAPS ไม่ผ่าน ใช้ชื่อเซิร์ฟเวอร์ให้ตรงใบรับรองและกรอก CA Certificate ของบริษัทให้ครบ");
  if (code.startsWith("ERR_SSL") || code === "EPROTO") return result(502,"LDAP_TLS_ERROR","เริ่ม TLS ไม่สำเร็จ ตรวจว่าใช้ ldaps:// กับพอร์ต 636 หรือ ldap:// กับพอร์ตที่รองรับ StartTLS");
  return result(500,"LDAP_OPERATION_FAILED","ดำเนินการ LDAP ไม่สำเร็จ กรุณาแจ้งรหัสอ้างอิงและขั้นตอนที่ผิดพลาดให้ผู้ดูแลตรวจสอบ");
}
