"use client";
import { useEffect,useState,type FormEvent } from "react";
import { smtpDefaults,type SmtpConfig } from "@/lib/smtp-policy";
import "./smtp-settings.css";
type Saved=Omit<SmtpConfig,"password"> & {hasPassword:boolean};
type Data={companies:{_id:string;name:string;nameTh?:string}[];configs:Saved[];encryptionReady:boolean};
export default function SmtpSettings() {
  const [data,setData]=useState<Data|null>(null),[form,setForm]=useState<SmtpConfig>({...smtpDefaults});
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  function select(companyId:string,result=data) {
    const saved=result?.configs.find(c=>c.companyId===companyId);
    setForm(saved?{...smtpDefaults,...saved,password:""}: {...smtpDefaults,companyId});
    setDirty(false);
  }
  async function load(companyId?:string,signal?:AbortSignal) {
    const response=await fetch("/api/smtp-settings",{cache:"no-store",signal}),result=await response.json();
    if(!response.ok)throw Error(result.error);
    setData(result);select(companyId||result.companies[0]?._id||"",result);
  }
  useEffect(()=>{const controller=new AbortController();load(undefined,controller.signal).catch(error=>{if(!controller.signal.aborted)setError(error.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[]);
  function change<K extends keyof SmtpConfig>(key:K,value:SmtpConfig[K]) {setForm(old=>({...old,[key]:value}));setDirty(true);setSuccess("");}
  async function action(action:"save"|"test") {
    if(busy||loading)return;setBusy(true);setError("");setSuccess("");
    try {
      // Only schema fields are sent; hasPassword is presentation data.
      const fields=Object.fromEntries(Object.keys(smtpDefaults).map(key=>[key,form[key as keyof SmtpConfig]]));
      const response=await fetch("/api/smtp-settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(action==="save"?{action,...fields}:{action,companyId:form.companyId})});
      const result=await response.json();if(!response.ok)throw Error(result.error);
      setSuccess(action==="save"?"บันทึกการตั้งค่า SMTP สำเร็จ":"เชื่อมต่อและยืนยันบัญชี SMTP สำเร็จ");
      if(action==="save")await load(form.companyId);
    } catch(error){setError(error instanceof Error?error.message:"ดำเนินการไม่สำเร็จ");}finally{setBusy(false);}
  }
  const saved=data?.configs.find(c=>c.companyId===form.companyId);
  function field(key:"host"|"username"|"password"|"fromEmail"|"fromName"|"appUrl",label:string,type="text",required=true) {
    return <label>{label}<input type={type} value={form[key]} required={required} maxLength={key==="password"?2000:key==="appUrl"?500:254} autoComplete={key==="password"?"new-password":"off"} placeholder={key==="password"&&saved?.hasPassword?"มีรหัสผ่านแล้ว เว้นว่างเพื่อใช้ค่าเดิม":undefined} onChange={e=>change(key,e.target.value)}/></label>;
  }
  return <div className="smtp-settings" aria-busy={loading||busy}>
    <div className="page-heading"><div><h1><span className="heading-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg></span>ตั้งค่า SMTP</h1><p className="muted">ตั้งค่าการส่งอีเมลลืมรหัสผ่าน แยกตามบริษัท</p></div></div>
    {error&&<p className="error" role="alert">{error}</p>}{success&&<p className="success" role="status">{success}</p>}
    <section className="panel"><h2>ตารางตั้งค่า SMTP</h2><div className="table-scroll"><table className="data-table"><thead><tr><th>บริษัท</th><th>SMTP Server</th><th>พอร์ต / การเข้ารหัส</th><th>อีเมลผู้ส่ง</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>
      {data?.companies.map(company=>{const config=data.configs.find(c=>c.companyId===company._id);return <tr key={company._id}><td>{company.nameTh||company.name}</td><td>{config?.host||"ยังไม่ตั้งค่า"}</td><td>{config?`${config.port} / ${config.security==="tls"?"TLS":"StartTLS"}`:"—"}</td><td>{config?.fromEmail||"—"}</td><td><span className={"smtp-status "+(config?.enabled?"enabled":"disabled")}>{config?.enabled?"เปิดใช้งาน":"ปิดใช้งาน"}</span></td><td><button type="button" className="ghost" disabled={busy||loading} onClick={()=>{if(dirty&&!window.confirm("มีข้อมูลที่ยังไม่บันทึก ต้องการเปลี่ยนบริษัทหรือไม่?"))return;select(company._id);setError("");setSuccess("");}}>ตั้งค่า</button></td></tr>;})}
      {!data?.companies.length&&<tr><td colSpan={6}>{loading?"กำลังโหลด…":"ไม่มีบริษัทที่คุณมีสิทธิ์ครบทุกสาขา"}</td></tr>}
    </tbody></table></div></section>
    {form.companyId&&<form className="panel" onSubmit={(event:FormEvent)=>{event.preventDefault();void action("save");}}>
      <h2>ตั้งค่า · {data?.companies.find(c=>c._id===form.companyId)?.nameTh||data?.companies.find(c=>c._id===form.companyId)?.name}</h2>
      {form.authEnabled&&data&&!data.encryptionReady&&<p className="smtp-note">เซิร์ฟเวอร์ยังไม่มีกุญแจเข้ารหัสรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบก่อนบันทึก</p>}
      <fieldset disabled={busy||loading} className="smtp-fields"><legend className="sr-only">การตั้งค่า SMTP</legend>
        {field("host","SMTP Server")}
        <label>พอร์ต<input type="number" min={1} max={65535} required value={form.port} onChange={e=>change("port",Number(e.target.value))}/></label>
        <label>การเข้ารหัส<select value={form.security} onChange={e=>{const security=e.target.value as SmtpConfig["security"];change("security",security);change("port",security==="tls"?465:587);}}><option value="starttls">StartTLS (ปกติพอร์ต 587)</option><option value="tls">TLS (ปกติพอร์ต 465)</option></select></label>
        <label className="smtp-check"><input type="checkbox" checked={form.authEnabled} onChange={e=>change("authEnabled",e.target.checked)}/>ยืนยันตัวตนด้วยชื่อผู้ใช้และรหัสผ่าน</label>
        {form.authEnabled&&<>{field("username","ชื่อผู้ใช้ SMTP")}{field("password","รหัสผ่าน SMTP","password",!saved?.hasPassword)}</>}
        {field("fromEmail","อีเมลผู้ส่ง","email")}{field("fromName","ชื่อผู้ส่ง","text",false)}{field("appUrl","URL ระบบสำหรับลิงก์ตั้งรหัสผ่านใหม่","url")}
        <label className="smtp-check"><input type="checkbox" checked={form.enabled} onChange={e=>change("enabled",e.target.checked)}/>เปิดใช้งานการส่งอีเมล</label>
        <p className="smtp-note smtp-wide">ลืมรหัสผ่านจะใช้ค่าของบริษัทที่ผูก LDAP กับผู้ใช้ หากไม่มีจะใช้บริษัทแรกในสิทธิ์ผู้ใช้ การทดสอบตรวจการเชื่อมต่อและยืนยันตัวตน โดยยังไม่ส่งอีเมล</p>
        <div className="smtp-buttons smtp-wide"><button disabled={form.authEnabled&&!data?.encryptionReady}>บันทึกการตั้งค่า</button><button type="button" className="secondary" disabled={!saved?.enabled||dirty} onClick={()=>void action("test")}>ทดสอบการเชื่อมต่อ</button></div>
      </fieldset>
    </form>}
  </div>;
}
