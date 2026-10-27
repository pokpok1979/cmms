"use client";
import Pagination from "./Pagination";
import { useEffect, useState } from "react";
import type { Role } from "@/lib/domain";
import type { permissionChanges } from "@/lib/permissions";
type Entry = {_id:string;actorName:string;at:string;changes:ReturnType<typeof permissionChanges>};
function HistoryIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M20.5 15a9 9 0 1 1-9-12 M12 7v5l4 2"/><path strokeDasharray="1 3" d="M15 3.5a9 9 0 0 1 6 8.5"/></svg>;
}
export default function RoleHistory({role,revision}:{role:Role;revision:number}) {
  const [items,setItems]=useState<Entry[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");
    fetch(`/api/role-permissions?${new URLSearchParams({historyRole:role,page:String(page)})}`,{cache:"no-store",signal:controller.signal})
      .then(async res=>{const data=await res.json();if(!res.ok)throw Error(data.error);if(!controller.signal.aborted){setItems(data.items);setTotal(data.total);}})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[role,revision,page,refresh]);
  return <section className="panel role-history" aria-labelledby="role-history-title" aria-busy={loading}>
    <div className="role-history-heading"><HistoryIcon/><h2 id="role-history-title">ประวัติการเปลี่ยนแปลงบทบาท</h2></div>
    {loading?<div className="role-history-empty" role="status">กำลังโหลดประวัติ…</div>:error?<div className="role-history-empty"><p className="error" role="alert">{error}</p><button className="secondary" onClick={()=>setRefresh(x=>x+1)}>ลองใหม่</button></div>:!items.length?<div className="role-history-empty"><span className="role-history-empty-icon"><HistoryIcon/></span><strong>ยังไม่มีประวัติ</strong></div>:<>
      <ol className="role-history-list">{items.map(item=><li key={item._id}>
        <span className="role-history-marker"><HistoryIcon/></span>
        <div className="role-history-entry"><div className="role-history-meta"><strong>{item.actorName}</strong><time dateTime={item.at}>{new Date(item.at).toLocaleString("th-TH",{timeZone:"Asia/Bangkok",dateStyle:"medium",timeStyle:"medium"})}</time></div>
          <p>แก้ไขสิทธิ์บทบาท · {item.changes.length} รายการ</p>
          {item.changes.length?<details><summary>ดูรายละเอียดการเปลี่ยนแปลง</summary><ul>{item.changes.map(change=><li key={`${change.module}.${change.action}`}><span>{change.moduleLabel} · {change.actionLabel}</span><span className={change.to?"role-change-enabled":"role-change-disabled"}>{change.to?"ปิด → เปิด":"เปิด → ปิด"}</span></li>)}</ul></details>:<small>บันทึกโดยไม่มีการเปลี่ยนแปลงสิทธิ์</small>}
        </div>
      </li>)}</ol>
      <Pagination page={page} total={total} count={items.length} loading={loading} onChange={setPage} />
    </>}
  </section>;
}
