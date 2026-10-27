"use client";
import { useEffect, useRef, useState } from "react";
import { actions, actionLabels, modules, defaultPermissions, type Matrix } from "@/lib/permissions";
import { userRoleLabels } from "@/lib/admin-users-policy";
import type { Role } from "@/lib/domain";
import "./permissions.css";
import RoleHistory from "./RoleHistory";
type Policy = {role:Role;matrix:Matrix;revision:number};
const roleDetails: Record<Role, {english:string;description:string;icon:string}> = {
  admin:{english:"System Administrator",description:"จัดการระบบ ผู้ใช้งาน และข้อมูลหลัก",icon:"M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z M12 8v5 M12 16h.01"},
  executive:{english:"Executive",description:"ติดตามภาพรวมและรายงานในขอบเขตสิทธิ์",icon:"M4 7h16v14H4z M8 7V3h8v4 M4 12h16"},
  supervisor:{english:"Maintenance Supervisor",description:"อนุมัติ มอบหมาย ตรวจรับ และดูแลงานซ่อมบำรุง",icon:"M8 3h8v4H8z M7 5H5v16h14V5h-2 M8 13l3 3 5-6"},
  technician:{english:"Technician",description:"รับงานและบันทึกผลการซ่อมที่ได้รับมอบหมาย",icon:"M14 6a5 5 0 0 0-6 6L3 17l4 4 5-5a5 5 0 0 0 6-6l-4 3-3-3z"},
  requester:{english:"Requester",description:"แจ้งซ่อม ติดตามงาน และยืนยันผลการซ่อม",icon:"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21v-2a8 8 0 0 1 16 0v2"},
};
const roleOrder: Role[] = ["admin","executive","supervisor","technician","requester"];
function RoleIcon({role}:{role:Role}) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={roleDetails[role].icon}/></svg>;
}
function Check({values, disabled, label, onChange}: {values:boolean[];disabled?:boolean;label:string;onChange:(checked:boolean)=>void}) {
  const ref = useRef<HTMLInputElement>(null), count = values.filter(Boolean).length;
  useEffect(() => {if(ref.current) ref.current.indeterminate = count > 0 && count < values.length;},[count,values.length]);
  return <input ref={ref} type="checkbox" aria-label={label} checked={values.length > 0 && count === values.length} disabled={disabled || !values.length} onChange={e=>onChange(e.target.checked)} />;
}
export default function PermissionMatrix({onSaved}: {onSaved:()=>void}) {
  const [policies,setPolicies]=useState<Policy[]>([]), [role,setRole]=useState<Role>("requester"), [matrix,setMatrix]=useState<Matrix|null>(null);
  const [overviewPolicies,setOverviewPolicies]=useState<Policy[]>([]), [overviewLoading,setOverviewLoading]=useState(false), [overviewError,setOverviewError]=useState(""), [overviewUpdatedAt,setOverviewUpdatedAt]=useState<Date|null>(null);
  const overviewRequest=useRef(0);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  const policy=policies.find(x=>x.role===role), base=defaultPermissions(role);
  const dirty=!!matrix && JSON.stringify(matrix)!==JSON.stringify(policy?.matrix);
  function selectRole(nextRole: Role) {
    if(nextRole === role)return;
    if(dirty&&!window.confirm("มีการแก้ไขที่ยังไม่บันทึก ต้องการเปลี่ยนบทบาทหรือไม่?"))return;
    setRole(nextRole);setMatrix(null);setError("");setSuccess("");
  }
  async function reload() {
    setBusy(true);setError("");
    try {const res=await fetch("/api/role-permissions",{cache:"no-store"});const data=await res.json();if(!res.ok)throw Error(data.error);setPolicies(data.roles);setOverviewPolicies(data.roles);setOverviewUpdatedAt(new Date());setMatrix(null);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  useEffect(()=>{void reload();},[]);
  async function refreshOverview() {
    const request=++overviewRequest.current;
    setOverviewLoading(true);setOverviewError("");
    try {
      const response=await fetch("/api/role-permissions",{cache:"no-store"});
      const data=await response.json();if(!response.ok)throw Error(data.error || "โหลดภาพรวมไม่สำเร็จ");
      if(request===overviewRequest.current){setOverviewPolicies(data.roles);setOverviewUpdatedAt(new Date());}
    } catch(error) {
      if(request===overviewRequest.current)setOverviewError(error instanceof Error?error.message:"โหลดภาพรวมไม่สำเร็จ");
    } finally {if(request===overviewRequest.current)setOverviewLoading(false);}
  }
  const current=matrix || policy?.matrix;
  function update(keys:string[], columns:readonly string[], enabled:boolean) {
    if(!current)return;
    const next=structuredClone(current);
    for(const key of keys) for(const action of actions) if(columns.includes(action)&&base[key][action]) {
      next[key][action]=enabled;
      if(enabled && action!=="view")next[key].view=true;
      if(!enabled && action==="view")for(const a of actions)next[key][a]=false;
    }
    setMatrix(next);setSuccess("");
  }
  async function save() {
    if(!current||!policy)return;setBusy(true);setError("");setSuccess("");
    try {const res=await fetch("/api/role-permissions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({role,matrix:current,revision:policy.revision})});const data=await res.json();if(!res.ok)throw Error(data.error);setPolicies(old=>old.map(x=>x.role===role?{...x,matrix:current,revision:x.revision+1}:x));setOverviewPolicies(old=>old.map(x=>x.role===role?{...x,matrix:current,revision:x.revision+1}:x));setMatrix(null);setSuccess("บันทึกสิทธิ์สำเร็จ");onSaved();await refreshOverview();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const keys=modules.map(([key])=>key), total=keys.reduce((n,key)=>n+actions.filter(a=>base[key][a]).length,0),count=current?keys.reduce((n,key)=>n+actions.filter(a=>current[key][a]).length,0):0;
  return <div className="permission-page">
    <div className="page-heading"><div><h1><span className="heading-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><circle cx="12" cy="10" r="2"/><path d="M12 12v4"/></svg></span>บทบาท &amp; สิทธิ์การใช้งาน (Roles &amp; Permissions)</h1><p className="muted">จัดการสิทธิ์ของบทบาท โดยยังคงขอบเขตบริษัท สาขา และขั้นตอนงานเดิม</p></div></div>
      <section className="panel permission-roles" aria-labelledby="all-roles-heading">
        <div className="permission-roles-heading"><span aria-hidden="true">⚿</span><h2 id="all-roles-heading">บทบาททั้งหมด</h2><span className="permission-role-count">{roleOrder.length}</span></div>
        <div className="permission-role-list" aria-label="เลือกบทบาท">
          {roleOrder.map(key=>{
            const saved=policies.find(x=>x.role===key), values=key===role?current:saved?.matrix;
            const rights=values?modules.reduce((sum,[module])=>sum+actions.filter(action=>values[module][action]).length,0):null;
            return <button type="button" key={key} className={`permission-role-item role-${key}${key===role?" selected":""}`} aria-pressed={key===role} disabled={busy} onClick={()=>selectRole(key)}>
              <span className="permission-role-icon"><RoleIcon role={key}/></span>
              <span className="permission-role-text"><strong>{userRoleLabels[key]}</strong><small>{key.toUpperCase()} · {rights===null?"กำลังโหลด…":`${rights} สิทธิ์`}{key===role&&dirty?" · ยังไม่บันทึก":""}</small></span>
              {key===role&&<span className="permission-role-selected" aria-hidden="true">✓</span>}
            </button>;
          })}
        </div>
      </section>
      <div className="permission-detail">
    {error&&<p className="error" role="alert">{error}</p>}{success&&<p className="success" role="status">{success}</p>}
    <section className="panel permission-panel" aria-busy={busy}>
      <div className="permission-toolbar"><strong>▦ ตารางสิทธิ์ (Permission Matrix) <small>{count} / {total} สิทธิ์</small></strong><div className="permission-presets"><button disabled={busy||!current} onClick={()=>{updateReadOnly();setSuccess("");}}>ดูอย่างเดียว</button><button disabled={busy||!current} onClick={()=>update(keys,actions,true)}>ทั้งหมด</button><button disabled={busy||!current} onClick={()=>update(keys,actions,false)}>ล้าง</button></div></div>
      <div className="permission-scroll"><table className="permission-table"><caption className="sr-only">สิทธิ์ของ{userRoleLabels[role]}</caption><thead><tr><th scope="col">โมดูล</th>{actions.map((action,i)=><th key={action} scope="col"><Check values={keys.filter(k=>base[k][action]).map(k=>!!current?.[k][action])} disabled={busy||!current} label={`เลือก${actionLabels[i]}ทั้งคอลัมน์`} onChange={v=>update(keys,[action],v)}/><span>{actionLabels[i]}</span></th>)}<th scope="col">ทั้งแถว</th></tr></thead><tbody>{modules.map(([key,label])=><tr key={key}><th scope="row"><span className="permission-icon">▦</span><span>{label}<small>{key}</small></span></th>{actions.map((action,i)=><td key={action}><Check values={[!!current?.[key][action]]} disabled={busy||!current||!base[key][action]} label={`${label}: ${actionLabels[i]}`} onChange={v=>update([key],[action],v)}/></td>)}<td><Check values={actions.filter(a=>base[key][a]).map(a=>!!current?.[key][a])} disabled={busy||!current} label={`เลือกทั้งแถว ${label}`} onChange={v=>update([key],actions,v)}/></td></tr>)}</tbody></table></div>
      <div className="permission-footer"><small>การให้สิทธิ์สร้าง/แก้ไข/ลบ/อนุมัติ จะเปิดสิทธิ์ดูข้อมูลด้วย • ช่องสีเทาคือสิทธิ์ที่บทบาทไม่รองรับ<br/>การเปลี่ยนแปลงมีผลกับผู้ใช้ทุกคนในบทบาทนี้ • Admin เข้าหน้าบทบาท &amp; สิทธิ์ได้เสมอ</small><button disabled={busy||!current||!dirty} onClick={save}>{busy?"กำลังดำเนินการ…":"✓ บันทึกสิทธิ์"}</button></div>
    </section>
      </div>
    <section className="panel permission-overview" aria-labelledby="permission-overview-heading" aria-busy={busy||overviewLoading}>
      <div className="permission-overview-heading">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18 M3 15h18 M9 3v18 M15 3v18"/></svg>
        <h2 id="permission-overview-heading">ภาพรวมสิทธิทุกบทบาท</h2>
        <small>V=ดู · C=สร้าง · E=แก้ไข · D=ลบ · A=อนุมัติ</small>
        <div className="permission-overview-refresh">
          {overviewUpdatedAt&&<small>อัปเดต {overviewUpdatedAt.toLocaleTimeString("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",second:"2-digit"})}</small>}
          <button type="button" className="secondary" disabled={busy||overviewLoading} onClick={()=>void refreshOverview()}>{overviewLoading?"กำลังอัปเดต…":"รีเฟรชภาพรวม"}</button>
        </div>
      </div>
      {overviewError&&<p className="error permission-overview-error" role="alert">{overviewError} · ข้อมูลที่แสดงอาจยังไม่ใช่ข้อมูลล่าสุด กรุณารีเฟรชอีกครั้ง</p>}
      {!overviewPolicies.length ? <p className="permission-overview-status" role="status">{busy||overviewLoading?"กำลังโหลดภาพรวมสิทธิ์…":"ยังไม่สามารถแสดงภาพรวมสิทธิ์ได้"}</p> : <div className="permission-scroll">
        <table className="permission-overview-table">
          <caption className="sr-only">ภาพรวมสิทธิ์ที่บันทึกแล้วของทุกบทบาท</caption>
          <thead><tr><th scope="col">โมดูล</th>{roleOrder.map(key=><th scope="col" key={key} className={`overview-role-${key}`}><abbr title={userRoleLabels[key]}>{({admin:"ADMIN",executive:"EXEC",supervisor:"SUPERVISOR",technician:"TECHNICIAN",requester:"REQUESTER"})[key]}</abbr></th>)}</tr></thead>
          <tbody>{modules.map(([module,label])=><tr key={module}><th scope="row"><span className="permission-overview-module"><span aria-hidden="true">▦</span>{label}</span></th>{roleOrder.map(key=>{
            const saved=overviewPolicies.find(item=>item.role===key)?.matrix[module];
            const codes=actions.map((action,i)=>saved?.[action]?"VCEDA"[i]:"").join("");
            const description=saved?actions.flatMap((action,i)=>saved[action]?[actionLabels[i]]:[]).join(", "):"";
            return <td key={key}>{codes?<span className={`permission-rights-badge ${codes==="VCEDA"?"rights-full":codes==="V"?"rights-view":"rights-partial"}`} title={`${userRoleLabels[key]}: ${description}`}><span aria-hidden="true">{codes}</span><span className="sr-only">{description}</span></span>:<span className="permission-rights-none" aria-label="ไม่มีสิทธิ์">—</span>}</td>;
          })}</tr>)}</tbody>
        </table>
      </div>}
    </section>
    <RoleHistory key={`${role}:${policy?.revision || 0}`} role={role} revision={policy?.revision || 0}/>
  </div>;
  function updateReadOnly(){if(!current)return;const next=defaultPermissions(role);for(const key of keys)for(const action of actions)next[key][action]=action==="view"&&base[key].view;setMatrix(next);}
}
