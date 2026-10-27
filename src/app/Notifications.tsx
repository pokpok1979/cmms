"use client";
import Pagination, { useClientPagination } from "./Pagination";
import { useCallback, useEffect, useRef, useState } from "react";
import "./notifications.css";
import { notificationTime } from "@/lib/notification-time";

type Item = { _id: string; module: string; entityId: string; message: string; actorName?: string; at: string; read: boolean };
type Props = { userId: string; full?: boolean; onOpen: (module: string, id?: string) => void };
async function request(body?: unknown) {
  const response = await fetch("/api/in-app-notifications", {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error("โหลดหรือบันทึกการแจ้งเตือนไม่สำเร็จ");
  return response.json();
}
export default function Notifications({ userId, full = false, onOpen }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Item | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    try {
      const data = await request();
      if (!full && seen.current) {
        const newest = (data.items as Item[]).find(item => !item.read && !seen.current!.has(item._id));
        if (newest) setToast(newest);
      }
      seen.current = new Set((data.items as Item[]).map(item => item._id));
      setItems(data.items); setUnread(data.unread); setError("");
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [full]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!active) return;
      if (!document.hidden) await refresh();
      if (active) timer = setTimeout(poll, 15000);
    };
    void poll();
    const update = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus", update);
    window.addEventListener("cmms-notifications", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false; clearTimeout(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("cmms-notifications", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh, userId]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); root.current?.querySelector("button")?.focus(); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  const pagination = useClientPagination(items, userId);
  async function mark(item?: Item) {
    if (item) {
      setOpen(false); setToast(null);
      onOpen(item.module, item.entityId);
      setItems(current => current.filter(row => row._id !== item._id));
      setUnread(current => Math.max(0, current - 1));
      try {
        await request({ id: item._id });
        window.dispatchEvent(new Event("cmms-notifications"));
      } catch (e) {
        setError((e as Error).message);
        await refresh();
      }
      return;
    }
    setSaving(true);
    try {
      await request({ all: true });
      setItems([]);
      setUnread(0);
      setToast(null);
      pagination.setPage(1);
      await refresh();
      window.dispatchEvent(new Event("cmms-notifications"));
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }
  return <div className={full ? "notification-center panel" : "notification-bell"} ref={root}>
    {!full && toast && <div className="notification-toast" role="status">
      <span>การแจ้งเตือนใหม่</span><p>{toast.message}</p>
      <button type="button" className="ghost" disabled={saving} onClick={() => void mark(toast)}>เปิดรายการ</button>
      <button type="button" className="ghost" aria-label="ปิดข้อความแจ้งเตือน" onClick={() => setToast(null)}>ปิด</button>
    </div>}
    {!full && <button type="button" className="ghost notification-toggle" aria-label={`การแจ้งเตือน ยังไม่อ่าน ${unread} รายการ`} aria-expanded={open} aria-controls="notification-popover" onClick={() => { setOpen(!open); void refresh(); }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {unread > 0 && <span className="notification-count">{unread > 99 ? "99+" : unread}</span>}
    </button>}
    {(full || open) && <section className={full ? "" : "notification-popover"} id={full ? undefined : "notification-popover"} aria-label="รายการแจ้งเตือน">
      <div className="notification-heading"><h2>การแจ้งเตือน <small>ยังไม่อ่าน {unread}</small></h2><button type="button" className="ghost" disabled={!unread || saving} onClick={() => void mark()}>อ่านทั้งหมด</button></div>
      {error && <p role="alert">{error} <button type="button" className="ghost" onClick={() => void refresh()}>ลองใหม่</button></p>}
      {loading ? <p role="status">กำลังโหลด…</p> : !items.length ? <p className="notification-empty">ยังไม่มีการแจ้งเตือน</p> : <ul className="notification-list">{(full ? pagination.items : items).map(item => <li key={item._id}>
        <button type="button" className={`notification-item ${item.read ? "" : "is-unread"}`} disabled={saving} onClick={() => void mark(item)}>
          <span className="notification-dot" aria-label={item.read ? "อ่านแล้ว" : "ยังไม่อ่าน"} />
          <span>{item.message}<time dateTime={item.at} title={new Date(item.at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}>{item.actorName ? `โดย ${item.actorName} · ` : ""}{notificationTime(item.at)}</time></span>
        </button>
      </li>)}</ul>}
      {full && <Pagination page={pagination.page} total={items.length} count={pagination.items.length} loading={loading || saving} onChange={pagination.setPage} />}
      {!full && <button type="button" className="ghost notification-all" onClick={() => { setOpen(false); onOpen("notifications"); }}>ดูการแจ้งเตือนทั้งหมด →</button>}
    </section>}
  </div>;
}
