"use client";

import { useEffect, useRef, useState } from "react";
import "./user-menu.css";

type Props = {
  user: { name: string; username?: string; email?: string; role: string };
  busy: boolean;
  onProfile: () => void;
  onNotifications: () => void;
  onGuide: () => void;
  onFlow: () => void;
  onSettings: () => void;
  onLogout: () => void;
};
const roles: Record<string, string> = {
  admin: "ผู้ดูแลระบบ", supervisor: "หัวหน้างานซ่อมบำรุง",
  technician: "ช่าง / ผู้รับผิดชอบ", requester: "ผู้แจ้งซ่อม", executive: "ผู้บริหาร",
};
function MenuIcon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    profile: "M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8 M4 22v-2a8 8 0 0 1 16 0v2",
    notifications: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
    book: "M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1v15",
    guide: "M9 3h6v5H9z M2 17h6v5H2z M16 17h6v5h-6z M12 8v5 M5 13h14 M5 13v4 M19 13v4",
    settings: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
    logout: "M9 3H3v18h6 M9 12h12 M17 8l4 4-4 4",
    shield: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3z",
    chevron: "M6 9l6 6 6-6",
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>;
}
export default function UserMenu({ user, busy, onProfile, onNotifications, onGuide, onFlow, onSettings, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const role = roles[user.role] || user.role;
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join("");
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  function choose(action: () => void) { setOpen(false); trigger.current?.focus(); action(); }
  return <div className="account-menu" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="account-trigger" aria-label={"บัญชีผู้ใช้งาน " + user.name} aria-expanded={open} aria-controls="account-panel" onClick={() => setOpen(!open)}>
      <span className="account-avatar" aria-hidden="true">{initials}</span>
      <span className="account-trigger-text"><strong>{user.name}</strong><small>{role}</small></span>
      <span className={"account-chevron" + (open ? " is-open" : "")}><MenuIcon kind="chevron"/></span>
    </button>
    {open && <div id="account-panel" className="account-panel" role="region" aria-label="เมนูบัญชีผู้ใช้งาน">
      <div className="account-summary"><span className="account-avatar account-avatar-large" aria-hidden="true">{initials}</span><div><strong>{user.name}</strong><p>{user.email || user.username || ""}</p><span className="account-role"><MenuIcon kind="shield"/>{role}</span></div></div>
      <div className="account-links">
        <button type="button" onClick={() => choose(onProfile)}><MenuIcon kind="profile"/>โปรไฟล์ของฉัน</button>
        <button type="button" onClick={() => choose(onNotifications)}><MenuIcon kind="notifications"/>การแจ้งเตือนทั้งหมด</button>
        <button type="button" onClick={() => choose(onGuide)}><MenuIcon kind="book"/>คู่มือ</button>
        <button type="button" onClick={() => choose(onFlow)}><MenuIcon kind="guide"/>Flow ระบบ</button>
        {user.role === "admin" && <button type="button" onClick={() => choose(onSettings)}><MenuIcon kind="settings"/>{"\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32\u0e23\u0e30\u0e1a\u0e1a"}</button>}
      </div>
      <div className="account-signout"><button type="button" disabled={busy} onClick={() => choose(onLogout)}><MenuIcon kind="logout"/>{busy ? "กำลังดำเนินการ…" : "ออกจากระบบ"}</button></div>
    </div>}
  </div>;
}
