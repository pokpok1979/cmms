"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import "./password-recovery.css";

export default function ForgotPasswordDialog({onClose}:{onClose:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState(""), [message,setMessage] = useState("");
  useEffect(()=>{dialog.current?.showModal();},[]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const email = String(new FormData(event.currentTarget).get("email") || "").trim();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "ส่งคำขอไม่สำเร็จ");
      setMessage(result.message);
    } catch(error) {setError(error instanceof Error ? error.message : "ส่งคำขอไม่สำเร็จ");}
    finally {setBusy(false);}
  }
  return <dialog ref={dialog} className="recovery-dialog" aria-labelledby="forgot-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <div className="recovery-heading"><h2 id="forgot-title">ลืมรหัสผ่าน</h2><button type="button" className="recovery-close" aria-label="ปิด" disabled={busy} onClick={onClose}>×</button></div>
    {message ? <><p className="success" role="status">{message}</p><button type="button" onClick={onClose}>กลับไปเข้าสู่ระบบ</button></> : <>
      <p className="muted">ระบุอีเมลที่ลงทะเบียนไว้ เพื่อรับลิงก์ตั้งรหัสผ่านใหม่ ลิงก์มีอายุ 15 นาที</p>
      <form onSubmit={submit} aria-busy={busy}>
        <label>อีเมล<input type="email" name="email" autoComplete="email" required maxLength={254} disabled={busy} autoFocus /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>{busy ? "กำลังส่งคำขอ…" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}</button>
      </form>
    </>}
    <p className="recovery-help">หากไม่มีอีเมลในระบบ หรือบัญชีถูกระงับ กรุณาติดต่อผู้ดูแลระบบ</p>
  </dialog>;
}
