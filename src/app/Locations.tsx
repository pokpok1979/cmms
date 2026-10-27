"use client";
import Pagination, { useClientPagination } from "./Pagination";
import { FormEvent, useEffect, useRef, useState } from "react";
import "./work-types.css";

type Location = { _id: string; companyId: string; name: string; siteId: string; floor?: string; revision?: number };
function Icon({ kind }: { kind: "locations" | "edit" | "delete" }) {
  const paths = {
    locations: "M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0z M15 10a3 3 0 1 1-6 0a3 3 0 1 1 6 0",
    edit: "M16 3l5 5-12 12-6 1 1-6L16 3z M14 5l5 5",
    delete: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}
export default function Locations({ onSaved }: { onSaved: () => void }) {
  const [items, setItems] = useState<Location[]>([]);
  const [q, setQ] = useState(""), [search, setSearch] = useState(""), [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<Location | null>(null), [deleting, setDeleting] = useState<Location | null>(null);
  const [name, setName] = useState(""), [siteId, setSiteId] = useState("");
  const [sites, setSites] = useState<{_id:string;name:string;companyId:string}[]>([]), [selection, setSelection] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch("/api/masters?kind=locations", { cache: "no-store", signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw Error(result.error); if (!controller.signal.aborted) {setItems(result.items);setSites(result.sites);setSiteId(previous=>result.sites.some((s: { _id:string })=>s._id===previous)?previous:result.sites[0]?._id || "");} })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  const filtered = items.filter(row => (!selection || row.siteId === selection) && `${row.name} ${sites.find(s=>s._id===row.siteId)?.name || ""}`.toLowerCase().includes(search.toLowerCase()));
  const pagination = useClientPagination(filtered, JSON.stringify([selection, search]));
  function resetEditor() { setEditing(null); setDeleting(null); setName("");  setSiteId(selection || sites[0]?._id || ""); }
  async function change(action: "save" | "delete", row = editing) {
    if (loading || saving) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/masters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "locations", action, id: row?._id, revision: row?.revision || 0, ...(action === "save" ? { name, siteId, ...(row?.floor !== undefined ? { floor: row.floor } : {}) } : {}) }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error);
      setSuccess(action === "delete" ? "ลบสถานที่สำเร็จ" : editing ? "แก้ไขสถานที่สำเร็จ" : "เพิ่มสถานที่สำเร็จ");
      resetEditor(); setRefresh(value => value + 1); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }
  function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void change("save"); }
  return <div className="work-types" aria-busy={loading || saving}>
    <div className="wt-heading"><span className="wt-heading-icon"><Icon kind="locations" /></span><div><h1>สถานที่</h1><p>จัดการสถานที่ในขอบเขตสิทธิ์ของผู้ดูแลระบบ</p></div><button type="button" className="secondary" disabled={loading || saving} onClick={() => { resetEditor(); input.current?.focus(); }}>＋ เพิ่มสถานที่</button></div>
    {error && <p className="error" role="alert">{error}</p>}{success && <p className="success" role="status">{success}</p>}
    <div className="wt-scope"><label>อาคาร/โรงงาน<select value={selection} disabled={loading || saving} onChange={event=>{setSelection(event.target.value);setEditing(null);setDeleting(null);setName("");setSiteId(event.target.value || sites[0]?._id || "");setSuccess("");}}><option value="">ทั้งหมด</option>{sites.map(site=><option key={site._id} value={site._id}>{site.companyId} / {site.name}</option>)}</select></label><span>{loading ? "กำลังโหลด…" : `${filtered.length} สถานที่`}</span></div>
    <div className="wt-layout">
      <section className="wt-panel"><header><h2>ตารางสถานที่</h2><button type="button" className="ghost" disabled={loading || saving} onClick={() => setRefresh(value => value + 1)}>↻ รีเฟรช</button></header>
        <form className="wt-search" onSubmit={event => { event.preventDefault(); setSearch(q.trim()); }}><input aria-label="ค้นหาสถานที่" placeholder="ค้นหาสถานที่ หรืออาคาร/โรงงาน…" value={q} onChange={event => setQ(event.target.value)} /><button type="submit" className="secondary" disabled={loading}>ค้นหา</button></form>
        {deleting && <div className="wt-delete-confirm" role="alert"><p>ลบสถานที่ “{deleting.name}” ใช่หรือไม่? ลบได้เมื่อไม่มีข้อมูลอ้างอิง</p><div><button type="button" className="wt-danger" disabled={saving} onClick={() => void change("delete", deleting)}>ยืนยันลบ</button><button type="button" className="secondary" disabled={saving} onClick={() => setDeleting(null)}>ยกเลิก</button></div></div>}
        <div className="wt-table-scroll"><table className="wt-table"><caption className="sr-only">สถานที่ในขอบเขตสิทธิ์</caption><thead><tr><th scope="col">สถานที่</th><th scope="col">อาคาร/โรงงาน</th><th scope="col">จัดการ</th></tr></thead><tbody>
          {pagination.items.map(row => <tr key={row._id} className={editing?._id === row._id ? "wt-editing" : ""}><td><strong>{row.name}</strong></td><td>{sites.find(s=>s._id===row.siteId)?.name || "—"}</td><td><div className="wt-actions"><button type="button" className="ghost" disabled={loading || saving} title="แก้ไข" aria-label={`แก้ไข ${row.name}`} onClick={() => { setEditing(row); setName(row.name); setSiteId(row.siteId);  setDeleting(null); input.current?.focus(); }}><Icon kind="edit" /></button><button type="button" className="ghost wt-delete" disabled={loading || saving} title="ลบ" aria-label={`ลบ ${row.name}`} onClick={() => setDeleting(row)}><Icon kind="delete" /></button></div></td></tr>)}
          {!filtered.length && <tr><td colSpan={3} className="wt-empty">{loading ? "กำลังโหลดสถานที่…" : "ไม่พบสถานที่"}</td></tr>}
        </tbody></table></div>
        <Pagination page={pagination.page} total={filtered.length} count={pagination.items.length} loading={loading} onChange={pagination.setPage} />
      </section>
      <section className="wt-panel wt-editor"><header><h2>{editing ? "แก้ไขสถานที่" : "เพิ่มสถานที่"}</h2></header><form onSubmit={save}>
        <fieldset disabled={loading || saving || !sites.length}><legend className="sr-only">ข้อมูลสถานที่</legend>
          <label><span>อาคาร/โรงงาน <span className="wt-required">*</span></span><select name="siteId" required value={siteId} disabled={!!editing} onChange={event=>setSiteId(event.target.value)}>{!sites.length&&<option value="">ไม่มีอาคาร/โรงงานในขอบเขตสิทธิ์</option>}{sites.map(site=><option key={site._id} value={site._id}>{site.companyId} / {site.name}</option>)}</select></label>
          <label><span>ชื่อสถานที่ <span className="wt-required">*</span></span><input ref={input} name="name" required maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label>
          <div className="wt-editor-actions"><button disabled={loading || saving || !sites.length}>{saving ? "กำลังบันทึก…" : "บันทึก"}</button>{editing && <button type="button" className="secondary" disabled={saving} onClick={resetEditor}>ยกเลิกแก้ไข</button>}</div>
        </fieldset>
      </form></section>
    </div>
  </div>;
}


