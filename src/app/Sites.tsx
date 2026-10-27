"use client";
import Pagination, { useClientPagination } from "./Pagination";
import { FormEvent, useEffect, useRef, useState } from "react";
import "./work-types.css";

type Site = { _id: string; companyId: string; name: string; revision?: number };
type Company = { _id: string; name: string; nameTh?: string };
function Icon({ kind }: { kind: "sites" | "edit" | "delete" }) {
  const paths = {
    sites: "M4 21V3h12v18 M16 9h4v12 M7 7h2 M11 7h2 M7 11h2 M11 11h2 M9 21v-6h4v6",
    edit: "M16 3l5 5-12 12-6 1 1-6L16 3z M14 5l5 5",
    delete: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}
export default function Sites({ onSaved }: { onSaved: () => void }) {
  const [items, setItems] = useState<Site[]>([]);
  const [q, setQ] = useState(""), [search, setSearch] = useState(""), [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<Site | null>(null), [deleting, setDeleting] = useState<Site | null>(null);
  const [name, setName] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]), [companyId, setCompanyId] = useState(""), [selection, setSelection] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch("/api/masters?kind=sites", { cache: "no-store", signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw Error(result.error); if (!controller.signal.aborted) {setItems(result.items);setCompanies(result.companies);setCompanyId(previous=>result.companies.some((c:Company)=>c._id===previous)?previous:result.companies[0]?._id || "");} })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  const companyName = (id:string) => companies.find(c=>c._id===id)?.nameTh || companies.find(c=>c._id===id)?.name || id;
  const filtered = items.filter(row => (!selection || row.companyId===selection) && `${row.name} ${row.companyId} ${companyName(row.companyId)}`.toLowerCase().includes(search.toLowerCase()));
  const pagination = useClientPagination(filtered, JSON.stringify([selection, search]));
  function resetEditor() { setEditing(null); setDeleting(null); setName(""); setCompanyId(selection || companies[0]?._id || ""); }
  async function change(action: "save" | "delete", row = editing) {
    if (loading || saving) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/masters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "sites", action, companyId: action === "delete" ? row?.companyId : companyId, id: row?._id, revision: row?.revision || 0, ...(action === "save" ? { name } : {}) }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error);
      setSuccess(action === "delete" ? "ลบอาคาร/โรงงาน/สาขาสำเร็จ" : editing ? "แก้ไขอาคาร/โรงงาน/สาขาสำเร็จ" : "เพิ่มอาคาร/โรงงาน/สาขาสำเร็จ");
      resetEditor(); setRefresh(value => value + 1); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }
  function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void change("save"); }
  return <div className="work-types" aria-busy={loading || saving}>
    <div className="wt-heading"><span className="wt-heading-icon"><Icon kind="sites" /></span><div><h1>อาคาร/โรงงาน/สาขา</h1><p>จัดการอาคาร/โรงงาน/สาขาในขอบเขตสิทธิ์ของผู้ดูแลระบบ</p></div><button type="button" className="secondary" disabled={loading || saving} onClick={() => { resetEditor(); input.current?.focus(); }}>＋ เพิ่มอาคาร/โรงงาน/สาขา</button></div>
    {error && <p className="error" role="alert">{error}</p>}{success && <p className="success" role="status">{success}</p>}
    <div className="wt-scope"><label>บริษัท<select value={selection} disabled={loading || saving} onChange={event=>{setSelection(event.target.value);setCompanyId(event.target.value || companies[0]?._id || "");setEditing(null);setDeleting(null);setName("");setSuccess("");}}><option value="">ทุกบริษัท</option>{companies.map(company=><option key={company._id} value={company._id}>{companyName(company._id)}</option>)}</select></label><span>{loading ? "กำลังโหลด…" : `${filtered.length} อาคาร/โรงงาน/สาขา`}</span></div>
    <div className="wt-layout">
      <section className="wt-panel"><header><h2>ตารางอาคาร/โรงงาน/สาขา</h2><button type="button" className="ghost" disabled={loading || saving} onClick={() => setRefresh(value => value + 1)}>↻ รีเฟรช</button></header>
        <form className="wt-search" onSubmit={event => { event.preventDefault(); setSearch(q.trim()); }}><input aria-label="ค้นหาอาคาร/โรงงาน/สาขา" placeholder="ค้นหาชื่ออาคาร/โรงงาน/สาขาหรือรหัสบริษัท…" value={q} onChange={event => setQ(event.target.value)} /><button type="submit" className="secondary" disabled={loading}>ค้นหา</button></form>
        {deleting && <div className="wt-delete-confirm" role="alert"><p>ลบอาคาร/โรงงาน/สาขา “{deleting.name}” ของบริษัท “{companyName(deleting.companyId)}” ใช่หรือไม่? ลบได้เมื่อไม่มีข้อมูลอ้างอิง</p><div><button type="button" className="wt-danger" disabled={saving} onClick={() => void change("delete", deleting)}>ยืนยันลบ</button><button type="button" className="secondary" disabled={saving} onClick={() => setDeleting(null)}>ยกเลิก</button></div></div>}
        <div className="wt-table-scroll"><table className="wt-table"><caption className="sr-only">อาคาร/โรงงาน/สาขาในขอบเขตสิทธิ์</caption><thead><tr><th scope="col">อาคาร/โรงงาน/สาขา</th><th scope="col">บริษัท</th><th scope="col">จัดการ</th></tr></thead><tbody>
          {pagination.items.map(row => <tr key={row._id} className={editing?._id === row._id ? "wt-editing" : ""}><td><strong>{row.name}</strong></td><td>{companyName(row.companyId)}</td><td><div className="wt-actions"><button type="button" className="ghost" disabled={loading || saving} title="แก้ไข" aria-label={`แก้ไข ${row.name}`} onClick={() => { setEditing(row); setCompanyId(row.companyId); setName(row.name); setDeleting(null); input.current?.focus(); }}><Icon kind="edit" /></button><button type="button" className="ghost wt-delete" disabled={loading || saving} title="ลบ" aria-label={`ลบ ${row.name}`} onClick={() => setDeleting(row)}><Icon kind="delete" /></button></div></td></tr>)}
          {!filtered.length && <tr><td colSpan={3} className="wt-empty">{loading ? "กำลังโหลดอาคาร/โรงงาน/สาขา…" : "ไม่พบอาคาร/โรงงาน/สาขา"}</td></tr>}
        </tbody></table></div>
        <Pagination page={pagination.page} total={filtered.length} count={pagination.items.length} loading={loading} onChange={pagination.setPage} />
      </section>
      <section className="wt-panel wt-editor"><header><h2>{editing ? "แก้ไขอาคาร/โรงงาน/สาขา" : "เพิ่มอาคาร/โรงงาน/สาขา"}</h2></header><form onSubmit={save}><fieldset disabled={loading || saving || !companies.length}><legend className="sr-only">ข้อมูลอาคาร/โรงงาน/สาขา</legend><label><span>บริษัท <span className="wt-required">*</span></span><select name="companyId" required value={companyId} disabled={!!editing} onChange={event=>setCompanyId(event.target.value)}><option value="">เลือกบริษัท</option>{companies.map(company=><option key={company._id} value={company._id}>{companyName(company._id)}</option>)}</select></label>{editing&&<p>บริษัทของอาคาร/โรงงาน/สาขาเดิมไม่สามารถเปลี่ยนได้ เพื่อรักษาข้อมูลอ้างอิง</p>}<label><span>ชื่ออาคาร/โรงงาน/สาขา <span className="wt-required">*</span></span><input ref={input} name="name" required maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label><div className="wt-editor-actions"><button disabled={loading || saving}>{saving ? "กำลังบันทึก…" : "บันทึก"}</button>{editing && <button type="button" className="secondary" disabled={saving} onClick={resetEditor}>ยกเลิกแก้ไข</button>}</div></fieldset></form></section>
    </div>
  </div>;
}
