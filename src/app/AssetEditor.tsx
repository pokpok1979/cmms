"use client";
import { useState } from "react";

type RecordData = Record<string, any>;
export default function AssetEditor({ asset, companyName, companies, sites, locations, busy, canEdit = true, canDelete = true, onSave, onDelete }: {
  asset: RecordData; companyName: string; companies: RecordData[]; sites: RecordData[]; locations: RecordData[]; busy: boolean; canEdit?: boolean; canDelete?: boolean;
  onSave: (values: RecordData) => Promise<void>; onDelete: () => Promise<void>;
}) {
  const [companyId, setCompanyId] = useState(asset.companyId);
  const [siteId, setSiteId] = useState(asset.siteId);
  const [locationId, setLocationId] = useState(asset.locationId || "");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return <div className="asset-editor">
    <div className="asset-editor-buttons">
      {canEdit && <button className="secondary" disabled={busy} onClick={() => { setEditing(!editing); setConfirmDelete(false); setCompanyId(asset.companyId); setSiteId(asset.siteId); setLocationId(asset.locationId || ""); }}> {editing ? "ยกเลิกแก้ไข" : "แก้ไขเครื่องจักร"}</button>}
      {canDelete && <button className="danger" disabled={busy} onClick={() => { setConfirmDelete(true); setEditing(false); }}>ลบเครื่องจักร</button>}
    </div>
    {canDelete && confirmDelete && <div className="asset-delete-confirm" role="alert">
      <p>ยืนยันลบเครื่องจักร {asset.code} • {asset.name}?</p>
      <div className="chips">
        <button className="danger" disabled={busy} onClick={onDelete}>ยืนยันลบ</button>
        <button className="secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>ยกเลิก</button>
      </div>
    </div>}
    {canEdit && editing && <form className="form-grid" onSubmit={async (e) => {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(e.currentTarget));
      await onSave({ ...values, companyId, siteId });
    }}>
      <h3 className="wide">แก้ไขข้อมูลเครื่องจักร</h3>
      <label>บริษัท<select value={companyId} required disabled={busy} onChange={e=>{setCompanyId(e.target.value);setSiteId("");setLocationId("");}}>
        <option value="" disabled>เลือกบริษัท</option>
        {!companies.some(x=>x._id===asset.companyId)&&<option value={asset.companyId}>{companyName}</option>}
        {companies.filter(x=>sites.some(site=>site.companyId===x._id)).map(x=><option key={x._id} value={x._id}>{x.nameTh||x.name||x.code||x._id}</option>)}
      </select></label>
      <label>อาคาร/โรงงาน/สาขา<select value={siteId} required disabled={busy||!companyId} onChange={e=>{setSiteId(e.target.value);setLocationId("");}}>
        <option value="" disabled>เลือกสาขา</option>
        {sites.filter(x=>x.companyId===companyId).map(x=><option key={x._id} value={x._id}>{x.name}</option>)}
      </select></label>
      {[["code", "รหัสทรัพย์สิน"], ["name", "ชื่อเครื่องจักร"], ["brand", "ยี่ห้อ"], ["model", "รุ่น"], ["serialNumber", "Serial Number"]].map(([name, label]) =>
        <label key={name}>{label}<input name={name} defaultValue={asset[name] || ""} required={["code", "name"].includes(name)} maxLength={name === "name" ? 2000 : 100} disabled={busy} /></label>
      )}
      <label>สถานที่<select name="locationId" value={locationId} onChange={e=>setLocationId(e.target.value)} required disabled={busy||!siteId}>
        <option value="" disabled>เลือกสถานที่</option>
        {locations.filter(x => x.companyId === companyId && x.siteId === siteId).map(x => <option key={x._id} value={x._id}>{x.name}</option>)}
      </select></label>
      <label>สถานะ<select name="status" defaultValue={asset.status || "active"} disabled={busy}>
        <option value="active">ใช้งาน</option><option value="repair">อยู่ระหว่างซ่อม</option><option value="standby">สำรอง</option><option value="retired">เลิกใช้งาน</option>
      </select></label>
      <div className="wide"><button disabled={busy}>บันทึกการแก้ไข</button></div>
    </form>}
  </div>;
}
