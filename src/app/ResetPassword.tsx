"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import "./password-recovery.css";

export default function ResetPasswordPage() {
  const [token,setToken] = useState<string|null>(null), [busy,setBusy] = useState(false), [error,setError] = useState(""), [done,setDone] = useState(false);
  const tokenLoaded = useRef(false);
  useEffect(()=>{
    if (tokenLoaded.current) return;
    tokenLoaded.current = true;
    setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
    window.history.replaceState(null,"",window.location.pathname);
  },[]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget), password = String(data.get("password") || ""), confirmPassword = String(data.get("confirmPassword") || "");
    if (password!==confirmPassword) {setError("รหัสผ่านยืนยันไม่ตรงกัน");return;}
    setBusy(true);setError("");
    try {
      const response = await fetch("/api/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,password,confirmPassword})});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "ตั้งรหัสผ่านไม่สำเร็จ");
      setDone(true);setToken("");
    } catch(error) {setError(error instanceof Error ? error.message : "ตั้งรหัสผ่านไม่สำเร็จ");}
    finally {setBusy(false);}
  }
  const valid = token && /^[a-f0-9]{64}$/.test(token);
  return <main className="reset-page"><section className="reset-card" aria-labelledby="reset-title">
    <div className="reset-brand"><img src="/age-logo.svg" width={48} height={48} alt="โลโก้บริษัท AGE"/>AGE CMMS</div>
    <h1 id="reset-title">ตั้งรหัสผ่านใหม่</h1>
    {done ? <p className="success" role="status">ตั้งรหัสผ่านใหม่สำเร็จ เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว</p> : token===null ? <p role="status">กำลังตรวจสอบลิงก์…</p> : !valid ? <p className="error" role="alert">ลิงก์ไม่ถูกต้อง กรุณากลับไปหน้าเข้าสู่ระบบและกด “ลืมรหัสผ่าน” เพื่อขอลิงก์ใหม่</p> : <>
      <p className="muted">กำหนดรหัสผ่านอย่างน้อย 12 ตัวอักษร หลังบันทึกระบบจะออกจากทุกอุปกรณ์</p>
      <form onSubmit={submit} aria-busy={busy}>
        <label>รหัสผ่านใหม่<input type="password" name="password" required minLength={12} maxLength={200} autoComplete="new-password" disabled={busy}/></label>
        <label>ยืนยันรหัสผ่านใหม่<input type="password" name="confirmPassword" required minLength={12} maxLength={200} autoComplete="new-password" disabled={busy}/></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>
      </form>
    </>}
    <a href="/">กลับไปเข้าสู่ระบบ</a>
  </section></main>;
}
