"use client";
import { FormEvent, useEffect, useState } from "react";
import { settingFieldLabels } from "@/lib/system-settings-policy";
import type { SiteSettings,SettingsValues } from "@/lib/system-settings-policy";
import "./system-settings.css";
type SettingsResult={
  sites:{companyId:string;siteId:string;name:string;companyName:string}[];settings:SiteSettings|null;
  stats:{bytes:number;collections:number;users:number;audits:number;totals:{collection:string;label:string;count:number;bytes:number}[]};
  system:{application:string;version:string;node:string;database:string;databaseName:string;timezone:string;serverTime:string;sessionDays:number;mode:string};
  history:{_id:string;at:string;actorName:string;detail?:{note?:string}}[];
};
function scopeKey(companyId:string,siteId:string){return JSON.stringify([companyId,siteId]);}
function displayDate(value:string){return new Date(value).toLocaleString("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"short"});}
function Icon({name}:{name:string}) {
  const paths:Record<string,string>={settings:"M4 7h16 M4 17h16 M8 4v6 M16 14v6",company:"M4 21V3h12v18 M16 9h4v12 M7 7h2 M11 7h2 M7 11h2 M11 11h2 M9 21v-6h4v6",database:"M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3 M4 6v12c0 2 4 3 8 3s8-1 8-3V6 M4 12c0 2 4 3 8 3s8-1 8-3",users:"M15 7a3 3 0 1 0-6 0a3 3 0 1 0 6 0 M5 21v-4a7 7 0 0 1 14 0v4",audit:"M3 12a9 9 0 1 1 3 7 M3 4v8h8 M12 7v5l3 2",system:"M8 3h8v3h4v14H4V6h4V3z M8 10h8v6H8z",save:"M5 12l4 4L19 6"};
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.settings}/></svg>;
}
export default function SystemSettings({onSaved}:{onSaved?:()=>void}) {
  const [data,setData]=useState<SettingsResult|null>(null),[selection,setSelection]=useState(""),[refresh,setRefresh]=useState(0);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");
    const params=new URLSearchParams();
    if(selection){const [companyId,siteId]=JSON.parse(selection);params.set("companyId",companyId);params.set("siteId",siteId);}
    fetch("/api/system-settings?"+params,{cache:"no-store",signal:controller.signal}).then(async response=>{
      const result=await response.json();if(!response.ok)throw Error(result.error);
      if(!controller.signal.aborted)setData(result);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[selection,refresh]);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!data?.settings||saving||loading)return;
    const form=new FormData(event.currentTarget),numeric=["normalHours","highHours","urgentHours"];
    const values=Object.fromEntries(Object.keys(settingFieldLabels).map(key=>[key,numeric.includes(key)?Number(form.get(key)):String(form.get(key)||"")]));
    setSaving(true);setError("");setSuccess("");
    try {
      const response=await fetch("/api/system-settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...values,companyId:data.settings.companyId,siteId:data.settings.siteId,revision:data.settings.revision})});
      const result=await response.json();if(!response.ok)throw Error(result.error);
      setSuccess(result.changed?"บันทึกการตั้งค่าสำเร็จ":"การตั้งค่าตรงกับข้อมูลที่บันทึกแล้ว");setRefresh(current=>current+1);onSaved?.();
    }catch(e){setError(e instanceof Error?e.message:"บันทึกการตั้งค่าไม่สำเร็จ");}finally{setSaving(false);}
  }
  const settings=data?.settings;
  const selectedKey=settings?scopeKey(settings.companyId,settings.siteId):"";
  const matchesSelection=!selection||selection===selectedKey;
  const amount=data?.stats.bytes || 0,unit=amount>=1048576?"MB":"KB",size=amount/(unit==="MB"?1048576:1024);
  function field(name:keyof SettingsValues,{span=1,type="text",required=false,maxLength,min,max,step,help}:{span?:number;type?:string;required?:boolean;maxLength?:number;min?:number;max?:number;step?:string;help?:string}={}) {
    return <label className={span===2?"ss-field ss-span-2":"ss-field"}>{settingFieldLabels[name]}{required&&<span className="ss-required" aria-hidden="true"> *</span>}<input name={name} type={type} defaultValue={settings?.[name]} required={required} maxLength={maxLength} min={min} max={max} step={step} {...(name==="taxId"?{pattern:"[0-9]{13}",inputMode:"numeric" as const}:{})}/>{help&&<small>{help}</small>}</label>;
  }
  return <div className="system-settings" aria-busy={loading}>
    <div className="ss-heading"><span className="ss-heading-icon"><Icon name="settings"/></span><div><h1>ตั้งค่าระบบ (System Settings)</h1><p>ข้อมูลบริษัท โรงงาน กฎงานซ่อม และข้อมูลระบบ</p></div><button type="button" className="secondary" disabled={loading||saving} onClick={()=>{setSuccess("");setRefresh(value=>value+1);}}>↻ รีเฟรชข้อมูล</button></div>
    {error&&<p role="alert" className="error">{error}</p>}{success&&<p role="status" className="success">{success}</p>}
    <div className="ss-summary">
      <article className="ss-kpi"><span className="ss-kpi-icon"><Icon name="database"/></span><span>ขนาดข้อมูลในขอบเขตสิทธิ์</span><strong>{data?size.toLocaleString("th-TH",{maximumFractionDigits:1}):"—"}<small>{unit}</small></strong><small>{data?`${data.stats.collections} ตารางข้อมูลหลัก`:"กำลังโหลด…"}</small></article>
      <a className="ss-kpi ss-blue" href="/?view=users"><span className="ss-kpi-icon"><Icon name="users"/></span><span>ผู้ใช้งาน</span><strong>{data?data.stats.users.toLocaleString("th-TH"):"—"}<small>บัญชี</small></strong><small>จัดการผู้ใช้งาน →</small></a>
      <a className="ss-kpi ss-violet" href="/?view=auditLogs"><span className="ss-kpi-icon"><Icon name="audit"/></span><span>บันทึกกิจกรรม</span><strong>{data?data.stats.audits.toLocaleString("th-TH"):"—"}<small>รายการ</small></strong><small>ดูประวัติการเปลี่ยนแปลง →</small></a>
      <article className="ss-kpi"><span className="ss-kpi-icon"><Icon name="system"/></span><span>เวอร์ชันระบบ</span><strong>{data?`v${data.system.version}`:"—"}</strong><small>{data?`Node.js ${data.system.node} · ${data.system.database}`:"กำลังโหลด…"}</small></article>
    </div>
    <div className="ss-scope"><label>อาคาร/โรงงานที่ตั้งค่า<select aria-label="เลือกบริษัทและโรงงาน" value={selection||selectedKey} disabled={loading||saving||!data?.sites.length} onChange={event=>{setSelection(event.target.value);setSuccess("");}}>{!data?.sites.length&&<option value="">{loading?"กำลังโหลด…":"ไม่มีโรงงานในขอบเขตสิทธิ์"}</option>}{data?.sites.map(site=><option key={scopeKey(site.companyId,site.siteId)} value={scopeKey(site.companyId,site.siteId)}>{site.companyName} · {site.name}</option>)}</select></label><span>การตั้งค่ามีผลเฉพาะอาคาร/โรงงานที่เลือก</span></div>
    <div className="ss-layout"><div className="ss-stack">
      <section className="ss-panel"><header><Icon name="company"/><h2>ข้อมูลบริษัทและกฎงานซ่อม</h2></header>
        {settings&&matchesSelection?<form key={`${selectedKey}:${settings.revision}:${refresh}`} onSubmit={save}>
          <fieldset className="ss-form-grid" disabled={saving||loading}>
            <legend className="sr-only">การตั้งค่าบริษัทและโรงงาน</legend>
            <h3 className="ss-section">ข้อมูลบริษัท</h3>
            {field("companyNameTh",{span:2,required:true,maxLength:200})}{field("companyNameEn",{span:2,maxLength:200})}
            {field("taxId",{maxLength:13,help:"ตัวเลข 13 หลัก"})}{field("phone",{maxLength:50})}{field("email",{type:"email",maxLength:150})}{field("website",{maxLength:150})}
            <label className="ss-field ss-wide">ที่อยู่<textarea name="address" rows={2} maxLength={500} defaultValue={settings.address}/></label>
            <h3 className="ss-section">โรงงาน / สถานที่</h3>
            {field("plantName",{span:2,required:true,maxLength:150,help:"ใช้เป็นชื่อโรงงานในระบบ"})}{field("workingDays",{span:2,maxLength:150,help:"ข้อมูลวันและเวลาทำงาน"})}
            <h3 className="ss-section">กฎงานซ่อม</h3>
            <div className="ss-rule-fields ss-wide">
            {field("normalHours",{type:"number",required:true,min:1,max:8760,step:"1",help:"ชั่วโมง · ค่าเริ่มต้น 72"})}
            {field("highHours",{type:"number",required:true,min:1,max:8760,step:"1",help:"ชั่วโมง · ค่าเริ่มต้น 24"})}
            {field("urgentHours",{type:"number",required:true,min:1,max:8760,step:"1",help:"ชั่วโมง · ค่าเริ่มต้น 4"})}
            </div>
            <p className="ss-form-help ss-wide">ระยะเวลากำหนดเสร็จใช้กับใบงานใหม่ที่สร้างเมื่ออนุมัติใบแจ้งซ่อม</p>
          </fieldset>
          <footer><span>THB · วันที่ พ.ศ. · เวลาไทย{settings.updatedAt?` · บันทึกล่าสุด ${displayDate(settings.updatedAt)}`:""}</span><button disabled={saving||loading}><Icon name="save"/>{saving?"กำลังบันทึก…":"บันทึกการตั้งค่า"}</button></footer>
        </form>:<p className="ss-empty">{loading?"กำลังโหลดการตั้งค่า…":"ไม่พบข้อมูลโรงงานที่ตั้งค่าได้"}</p>}
      </section>
      <section className="ss-panel"><header><Icon name="audit"/><h2>ประวัติการเปลี่ยนแปลงการตั้งค่า</h2><a href="/?view=auditLogs&module=settings">ทั้งหมด →</a></header><div className="ss-history">{data?.history.length?data.history.map(entry=><div className="ss-history-item" key={entry._id}><span className="ss-history-dot"/><div><p>{entry.detail?.note || "บันทึกการตั้งค่าระบบ"}</p><small>{entry.actorName || "—"} · {displayDate(entry.at)}</small></div></div>):<p className="ss-empty">{loading?"กำลังโหลด…":"ยังไม่มีประวัติการเปลี่ยนแปลงการตั้งค่า"}</p>}</div></section>
    </div><div className="ss-stack">
      <section className="ss-panel"><header><Icon name="system"/><h2>ข้อมูลระบบ</h2></header><dl className="ss-system-info">{data&&[
        ["แอปพลิเคชัน",`${data.system.application} v${data.system.version}`],["Node.js",data.system.node],["ฐานข้อมูล",data.system.database],["ชื่อฐานข้อมูล",data.system.databaseName],
        ["เขตเวลา",data.system.timezone],["เวลาเซิร์ฟเวอร์",displayDate(data.system.serverTime)],["อายุการเข้าสู่ระบบผ่าน Cookie",`${data.system.sessionDays} วัน`],["โหมด",data.system.mode],
      ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      <section className="ss-panel"><header><Icon name="database"/><h2>จำนวนข้อมูลในตารางหลัก</h2></header><dl className="ss-system-info">{data?.stats.totals.map(row=><div key={row.collection}><dt title={row.collection}>{row.label}</dt><dd>{row.count.toLocaleString("th-TH")}</dd></div>)}</dl><p className="ss-count-note">จำนวนข้อมูลตามขอบเขตสิทธิ์ของผู้ดูแลระบบ</p></section>
    </div></div>
  </div>;
}
