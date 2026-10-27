"use client";
import Pagination, { useClientPagination } from "./Pagination";
import { FormEvent,useEffect,useRef,useState } from "react";
import type { WorkType } from "@/lib/work-types-policy";
import "./work-types.css";
type Result={items:WorkType[];total:number;sites:{_id:string;companyId:string;siteId:string;name:string}[];companyId:string;siteId:string};
const key=(companyId:string,siteId:string)=>JSON.stringify([companyId,siteId]);
function Icon({kind}:{kind:string}){const paths:Record<string,string>={types:"M4 4h7v7H4z M14 4h6v7h-6z M4 14h7v6H4z M14 14h6v6h-6z",edit:"M16 3l5 5-12 12-6 1 1-6L16 3z M14 5l5 5",delete:"M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7"};return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>;}
export default function WorkTypes({onSaved}:{onSaved?:()=>void}){
  const [data,setData]=useState<Result|null>(null),[selection,setSelection]=useState(""),[q,setQ]=useState(""),[search,setSearch]=useState(""),[refresh,setRefresh]=useState(0);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  const [editing,setEditing]=useState<WorkType|null>(null),[name,setName]=useState(""),[description,setDescription]=useState(""),[deleting,setDeleting]=useState<WorkType|null>(null);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");
    const params=new URLSearchParams({q:search});if(selection){const [companyId,siteId]=JSON.parse(selection);params.set("companyId",companyId);params.set("siteId",siteId);}
    fetch("/api/work-types?"+params,{cache:"no-store",signal:controller.signal}).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error);if(!controller.signal.aborted)setData(result);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[selection,search,refresh]);
  const selectedKey=data?key(data.companyId,data.siteId):"",matches=!selection||selection===selectedKey;
  const pagination = useClientPagination(matches ? data?.items || [] : [], JSON.stringify([selection, search]));
  function resetEditor(){setEditing(null);setName("");setDescription("");setDeleting(null);}
  async function change(payload:Record<string,unknown>){
    if(saving||loading||!matches||!data?.siteId)return;
    setSaving(true);setError("");setSuccess("");
    try{
      const response=await fetch("/api/work-types",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,companyId:data.companyId,siteId:data.siteId})});
      const result=await response.json();if(!response.ok)throw Error(result.error);
      setSuccess(payload.action==="delete"?"ลบประเภทงานออกจากตัวเลือกแล้ว":editing?"แก้ไขประเภทงานสำเร็จ":"เพิ่มประเภทงานสำเร็จ");
      resetEditor();setRefresh(value=>value+1);onSaved?.();
    }catch(e){setError(e instanceof Error?e.message:"บันทึกไม่สำเร็จ");}finally{setSaving(false);}
  }
  function save(event:FormEvent<HTMLFormElement>){event.preventDefault();void change({action:"save",...(editing?{id:editing._id}:{}),revision:editing?.revision || 0,name,description});}
  return <div className="work-types" aria-busy={loading}>
    <div className="wt-heading"><span className="wt-heading-icon"><Icon kind="types"/></span><div><h1>ประเภทงาน</h1><p>รายการประเภทงานสำหรับเลือกในใบแจ้งซ่อม แยกตามอาคาร/โรงงาน</p></div><button type="button" className="secondary" disabled={loading||saving} onClick={()=>{resetEditor();input.current?.focus();}}>＋ เพิ่มประเภทงาน</button></div>
    {error&&<p className="error" role="alert">{error}</p>}{success&&<p className="success" role="status">{success}</p>}
    <div className="wt-scope"><label>อาคาร/โรงงาน<select value={selection||selectedKey} disabled={loading||saving||!data?.sites.length} onChange={event=>{setSelection(event.target.value);resetEditor();setSuccess("");}}>{!data?.sites.length&&<option value="">{loading?"กำลังโหลด…":"ไม่มีโรงงานในขอบเขตสิทธิ์"}</option>}{data?.sites.map(site=><option key={key(site.companyId,site.siteId)} value={key(site.companyId,site.siteId)}>{site.companyId} / {site.name}</option>)}</select></label><span>{loading?"กำลังโหลด…":`${matches?data?.total || 0:0} ประเภทงาน`}</span></div>
    <div className="wt-layout"><section className="wt-panel"><header><h2>ตารางประเภทงาน</h2><button type="button" className="ghost" disabled={loading||saving} onClick={()=>setRefresh(value=>value+1)}>↻ รีเฟรช</button></header><form className="wt-search" onSubmit={event=>{event.preventDefault();setSearch(q);}}><input aria-label="ค้นหาประเภทงาน" placeholder="ค้นหาประเภทงานหรือคำอธิบาย…" value={q} onChange={event=>setQ(event.target.value)}/><button type="submit" className="secondary" disabled={loading}>ค้นหา</button></form>
      {deleting&&<div className="wt-delete-confirm" role="alert"><p>ลบประเภทงาน “{deleting.name}” ออกจากตัวเลือกใหม่ใช่หรือไม่? ประวัติใบแจ้งซ่อมเดิมยังคงอยู่</p><div><button type="button" disabled={saving} className="wt-danger" onClick={()=>void change({action:"delete",id:deleting._id,revision:deleting.revision})}>ยืนยันลบ</button><button type="button" className="secondary" disabled={saving} onClick={()=>setDeleting(null)}>ยกเลิก</button></div></div>}
      <div className="wt-table-scroll"><table className="wt-table"><caption className="sr-only">ประเภทงานในโรงงานที่เลือก</caption><thead><tr><th scope="col">ประเภทงาน</th><th scope="col">คำอธิบาย</th><th scope="col">จัดการ</th></tr></thead><tbody>{matches&&pagination.items.map(row=><tr key={row._id} className={editing?._id===row._id?"wt-editing":""}><td><strong>{row.name}</strong></td><td>{row.description || "—"}</td><td><div className="wt-actions"><button type="button" className="ghost" disabled={loading||saving} title="แก้ไข" aria-label={`แก้ไข ${row.name}`} onClick={()=>{setEditing(row);setName(row.name);setDescription(row.description);setDeleting(null);input.current?.focus();}}><Icon kind="edit"/></button><button type="button" className="ghost wt-delete" disabled={loading||saving} title="ลบ" aria-label={`ลบ ${row.name}`} onClick={()=>setDeleting(row)}><Icon kind="delete"/></button></div></td></tr>)}{(!matches||!data?.items.length)&&<tr><td colSpan={3} className="wt-empty">{loading?"กำลังโหลดประเภทงาน…":"ไม่พบประเภทงาน"}</td></tr>}</tbody></table></div>
      <Pagination page={pagination.page} total={matches ? data?.items.length || 0 : 0} count={pagination.items.length} loading={loading} onChange={pagination.setPage} />
    </section><section className="wt-panel wt-editor"><header><h2>{editing?"แก้ไขประเภทงาน":"เพิ่มประเภทงาน"}</h2></header><form onSubmit={save}><fieldset disabled={saving||loading||!matches||!data?.siteId}><legend className="sr-only">ข้อมูลประเภทงาน</legend><label><span>ชื่อประเภทงาน <span className="wt-required">*</span></span><input ref={input} name="name" value={name} maxLength={150} required onChange={event=>setName(event.target.value)}/></label><label>คำอธิบาย<textarea name="description" value={description} maxLength={500} rows={3} onChange={event=>setDescription(event.target.value)}/></label><div className="wt-editor-actions"><button disabled={saving||loading||!matches||!data?.siteId}>{saving?"กำลังบันทึก…":"บันทึก"}</button>{editing&&<button type="button" className="secondary" disabled={saving} onClick={resetEditor}>ยกเลิกแก้ไข</button>}</div></fieldset></form></section></div>
  </div>;
}