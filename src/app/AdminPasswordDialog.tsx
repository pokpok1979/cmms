"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Props = {
  account: { name: string; username: string; _id: string };
  onClose: () => void;
  onSaved: () => void;
};

export default function AdminPasswordDialog({
  account,
  onClose,
  onSaved,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (password !== confirm) {
      setError("รหัสผ่านใหม่และรหัสผ่านยืนยันไม่ตรงกัน");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/admin-users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: account._id,
          newPassword: password,
          confirmPassword: confirm,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="au-dialog"
      aria-labelledby="password-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form onSubmit={save}>
        <div className="au-dialog-heading">
          <h2 id="password-dialog-title">ตั้งรหัสผ่านใหม่</h2>
          <button
            type="button"
            className="au-close"
            aria-label="ปิด"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="au-password-account">
          <strong>{account.name}</strong>
          <small>{account.username}</small>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <label>
          รหัสผ่านใหม่ *
          <input
            type={show ? "text" : "password"}
            required
            minLength={12}
            maxLength={200}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small>อย่างน้อย 12 ตัวอักษร</small>
        </label>

        <label>
          ยืนยันรหัสผ่านใหม่ *
          <input
            type={show ? "text" : "password"}
            required
            minLength={12}
            maxLength={200}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>

        <label className="au-show-password">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
          />
          แสดงรหัสผ่าน
        </label>

        <small>
          เมื่อบันทึก ระบบจะยกเลิกการเข้าสู่ระบบเดิมทุกอุปกรณ์ของบัญชีนี้
        </small>

        <div className="au-form-actions">
          <button
            type="button"
            className="au-cancel"
            disabled={busy}
            onClick={onClose}
          >
            ยกเลิก
          </button>
          <button disabled={busy}>
            {busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่าน"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
