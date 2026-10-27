"use client";
import Pagination, { useClientPagination } from "./Pagination";
import { FormEvent,useEffect,useRef,useState } from "react";
import "./work-types.css";
import "./companies.css";
type Company={_id:string;nameTh:string;nameEn:string;phone:string;email:string;website:string;address:string;revision:number;siteCount:number;canManage:boolean};
const empty={code:"",nameTh:"",nameEn:"",phone:"",email:"",website:"",address:"",firstSiteName:""};
export default function Companies({onSaved}:{onSaved?:()=>void}){
  const [data,setData]=useState<{items:Company[];total:number}|null>(null),[q,setQ]=useState(""),[search,setSearch]=useState(""),[refresh,setRefresh]=useState(0);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  const [editing,setEditing]=useState<Company|null>(null),[form,setForm]=useState(empty),[deleting,setDeleting]=useState<Company|null>(null);const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");
    fetch("/api/companies?"+new URLSearchParams({q:search}),{cache:"no-store",signal:controller.signal}).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error);if(!controller.signal.aborted)setData(result);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[search,refresh]);
  const pagination = useClientPagination(data?.items || [], search);
  function reset(){setEditing(null);setForm(empty);setDeleting(null);}
  async function change(payload:Record<string,unknown>){
    if(loading||saving)return;setSaving(true);setError("");setSuccess("");
    try{
      const response=await fetch("/api/companies",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json();if(!response.ok)throw Error(result.error);
      setSuccess(payload.action==="delete"?"ลบบริษัทสำเร็จ":editing?"แก้ไขบริษัทสำเร็จ":"เพิ่มบริษัทและโรงงาน / สาขาเริ่มต้นสำเร็จ");reset();setRefresh(value=>value+1);onSaved?.();
    }catch(e){setError(e instanceof Error?e.message:"บันทึกไม่สำเร็จ");}finally{setSaving(false);}
  }
  function save(event:FormEvent<HTMLFormElement>){event.preventDefault();void change({action:"save",...form,...(editing?{id:editing._id}:{}),revision:editing?.revision || 0});}
  function field(name:keyof typeof empty,label:string,{required=false,type="text",maxLength=150,wide=false,disabled=false}:{required?:boolean;type?:string;maxLength?:number;wide?:boolean;disabled?:boolean}={}){return <label className={wide?"cmp-wide":""}><span>{label}{required&&<b className="wt-required"> *</b>}</span><input ref={name==="nameTh"?input:undefined} name={name} type={type} value={form[name]} required={required} disabled={disabled} maxLength={maxLength} onChange={event=>setForm(current=>({...current,[name]:event.target.value}))}/></label>;}
  return <div className="work-types companies" aria-busy={loading}>
    <div className="wt-heading"><span className="wt-heading-icon"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 21V3h12v18 M16 9h4v12 M7 7h2 M11 7h2 M7 11h2 M11 11h2 M9 21v-6h4v6"/></svg></span><div><h1>บริษัท</h1><p>จัดการข้อมูลบริษัทในขอบเขตสิทธิ์ของผู้ดูแลระบบ</p></div><button type="button" className="secondary" disabled={loading||saving} onClick={()=>{reset();input.current?.focus();}}>＋ เพิ่มบริษัท</button></div>
    {error&&<p className="error" role="alert">{error}</p>}{success&&<p className="success" role="status">{success}</p>}
    <div className="wt-layout"><section className="wt-panel"><header><h2>ตารางบริษัท <small className="cmp-count">{data?.total || 0} บริษัท</small></h2><button type="button" className="ghost" disabled={loading||saving} onClick={()=>setRefresh(value=>value+1)}>↻ รีเฟรช</button></header><form className="wt-search" onSubmit={event=>{event.preventDefault();setSearch(q);}}><input aria-label="ค้นหาบริษัท" placeholder="รหัสบริษัท, ชื่อบริษัท, โทรศัพท์, อีเมล…" value={q} onChange={event=>setQ(event.target.value)}/><button className="secondary" disabled={loading}>ค้นหา</button></form>
      {deleting&&<div className="wt-delete-confirm" role="alert"><p>ลบบริษัท “{deleting.nameTh}” และโรงงาน / สาขาที่ไม่มีข้อมูลอ้างอิงใช่หรือไม่?</p><div><button type="button" className="wt-danger" disabled={saving} onClick={()=>void change({action:"delete",id:deleting._id,revision:deleting.revision})}>ยืนยันลบ</button><button type="button" className="secondary" disabled={saving} onClick={()=>setDeleting(null)}>ยกเลิก</button></div></div>}
      <div className="wt-table-scroll"><table className="wt-table"><caption className="sr-only">บริษัทที่มีสิทธิ์เข้าถึง</caption><thead><tr><th scope="col">รหัสบริษัท</th><th scope="col">ชื่อบริษัท</th><th scope="col">ติดต่อ</th><th scope="col">สาขา</th><th scope="col">จัดการ</th></tr></thead><tbody>{pagination.items.map(company=><tr key={company._id} className={editing?._id===company._id?"wt-editing":""}><td>{company._id}</td><td><strong>{company.nameTh}</strong>{company.nameEn&&<small>{company.nameEn}</small>}</td><td><span>{company.phone || "—"}</span>{company.email&&<small>{company.email}</small>}</td><td>{company.siteCount}</td><td><div className="wt-actions"><button type="button" className="ghost" disabled={loading||saving||!company.canManage} title={company.canManage?"แก้ไข":"ต้องมีสิทธิ์ครบทุกสาขาของบริษัท"} aria-label={`แก้ไข ${company.nameTh}`} onClick={()=>{setEditing(company);setForm({code:company._id,nameTh:company.nameTh,nameEn:company.nameEn,phone:company.phone,email:company.email,website:company.website,address:company.address,firstSiteName:""});setDeleting(null);input.current?.focus();}}>✎</button><button type="button" className="ghost wt-delete" disabled={loading||saving||!company.canManage} title={company.canManage?"ลบ":"ต้องมีสิทธิ์ครบทุกสาขาของบริษัท"} aria-label={`ลบ ${company.nameTh}`} onClick={()=>setDeleting(company)}>×</button></div></td></tr>)}{!data?.items.length&&<tr><td colSpan={5} className="wt-empty">{loading?"กำลังโหลดบริษัท…":"ไม่พบบริษัท"}</td></tr>}</tbody></table></div>
      <Pagination page={pagination.page} total={data?.items.length || 0} count={pagination.items.length} loading={loading} onChange={pagination.setPage} />
    </section><section className="wt-panel wt-editor"><header><h2>{editing?"แก้ไขบริษัท":"เพิ่มบริษัท"}</h2></header><form onSubmit={save}><fieldset disabled={saving||loading} className="cmp-form"><legend className="sr-only">ข้อมูลบริษัท</legend>
      {field("code","รหัสบริษัท",{required:true,maxLength:30,disabled:Boolean(editing),wide:true})}
      {field("nameTh","ชื่อบริษัท (ไทย)",{required:true,maxLength:200,wide:true})}{field("nameEn","ชื่อบริษัท (อังกฤษ)",{maxLength:200,wide:true})}
      {field("phone","โทรศัพท์",{maxLength:50})}{field("email","อีเมล",{type:"email"})}{field("website","เว็บไซต์",{wide:true})}
      <label className="cmp-wide"><span>ที่อยู่</span><textarea name="address" rows={2} maxLength={500} value={form.address} onChange={event=>setForm(current=>({...current,address:event.target.value}))}/></label>
      {!editing&&field("firstSiteName","โรงงาน / สาขาเริ่มต้น",{required:true,wide:true})}
      {!editing&&<p className="cmp-help cmp-wide">สร้างโรงงาน / สาขาเริ่มต้นและให้สิทธิ์ผู้ดูแลที่สร้างบริษัทเพื่อเริ่มใช้งาน</p>}
      <div className="wt-editor-actions cmp-wide"><button disabled={saving||loading}>{saving?"กำลังบันทึก…":"บันทึก"}</button>{editing&&<button type="button" className="secondary" disabled={saving} onClick={reset}>ยกเลิกแก้ไข</button>}</div>
    </fieldset></form></section></div>
  </div>;
}