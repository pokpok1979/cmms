"use client";
import Pagination from "./Pagination";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { User } from "@/lib/domain";
import { userRoleLabels, userRoles, Grant } from "@/lib/admin-users-policy";
import "./admin-users.css";
import AdminPasswordDialog from "./AdminPasswordDialog";
type Account = {
  _id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  role: string;
  active: boolean;
  grants: Grant[];
  lastLoginAt?: string;
  activityCount?: number;
  authSource?: string;
};
type Site = { _id: string; companyId: string; name: string };
type Result = {
  items: Account[];
  total: number;
  page: number;
  pageSize: number;
  stats: { total: number; active: number; suspended: number; admins: number };
  departments: string[];
};
type Form = Omit<Account, "_id"> & { id?: string; password: string };
const empty: Form = {
  username: "",
  name: "",
  email: "",
  phone: "",
  department: "",
  position: "",
  role: "requester",
  active: true,
  grants: [],
  password: "",
};
function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    users:
      "M9 11a4 4 0 1 0 0-8a4 4 0 1 0 0 8 M2 21v-3a7 7 0 0 1 14 0v3 M17 4a4 4 0 0 1 0 8 M20 21v-3a7 7 0 0 0-2-5",
    edit: "M16 3l5 5-12 12-6 1 1-6L16 3z M14 5l5 5",
    search: "M21 21l-6-6 M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0",
    active: "M5 12l4 4L19 6",
    lock: "M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4",
    shield: "M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3z",
    close: "M6 6l12 12 M18 6L6 18",
    filter: "M3 4h18l-7 8v8l-4-2v-6L3 4z",
    key: "M14 4a5 5 0 1 0 0 10a5 5 0 1 0 0-10 M10 12l-7 7v3h3v-3h3v-3 M16 7h.01",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.users} />
    </svg>
  );
}
function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => Array.from(x)[0])
      .join("") || "?"
  );
}
function timeAgo(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "ยังไม่มีข้อมูล";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) return "เมื่อสักครู่";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;

  return `${Math.floor(seconds / 86400)} วันที่แล้ว`;
}
export default function AdminUsers({
  currentUser,
  sites,
  onSaved,
}: {
  currentUser: User;
  sites: Site[];
  onSaved?: (requiresLogin: boolean) => void;
}) {
  const [data, setData] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [revision, setRevision] = useState(0);
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [role, setRole] = useState(""),
    [department, setDepartment] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const [form, setForm] = useState<Form | null>(null),
    [formError, setFormError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const availableSites = sites.filter((site) =>
    currentUser.grants.some(
      (g) => g.companyId === site.companyId && g.siteId === site._id,
    ),
  );
  const [passwordTarget, setPasswordTarget] = useState<Account | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      q: search,
      role,
      department,
      status,
      page: String(page),
    });
    fetch("/api/admin-users?" + params, {
      cache: "no-store",
      signal: abort.signal,
    })
      .then(async (res) => {
        const x = await res.json();
        if (!res.ok) throw Error(x.error || "โหลดผู้ใช้ไม่สำเร็จ");
        return x;
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [search, role, department, status, page, revision]);
  useEffect(() => {
    if (form) dialog.current?.showModal();
    else dialog.current?.close();
  }, [Boolean(form)]);
  function close() {
    if (!busy) {
      setForm(null);
      setFormError("");
    }
  }
  function create() {
    setSuccess("");
    setFormError("");
    setForm({
      ...empty,
      grants: availableSites[0]
        ? [
            {
              companyId: availableSites[0].companyId,
              siteId: availableSites[0]._id,
            },
          ]
        : [],
    });
  }
  function edit(account: Account) {
    setSuccess("");
    setFormError("");
    setForm({
      id: account._id,
      username: account.username,
      name: account.name,
      email: account.email || "",
      phone: account.phone || "",
      department: account.department || "",
      position: account.position || "",
      role: account.role,
      active: account.active === true,
      grants: account.grants,
      password: "",
    });
  }
  function field(key: keyof Form, value: unknown) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, password: form.password || undefined }),
      });
      const x = await res.json();
      if (!res.ok) throw Error(x.error || "บันทึกไม่สำเร็จ");
      setForm(null);
      setSuccess(form.id ? "แก้ไขผู้ใช้งานสำเร็จ" : "เพิ่มผู้ใช้งานสำเร็จ");
      setRevision((r) => r + 1);
      onSaved?.(Boolean(form.id === currentUser._id && form.password));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  const self = form?.id === currentUser._id;
  return (
    <div className="admin-users-page">
      <div className="au-heading">
        <div className="au-heading-main">
          <span className="au-heading-icon">
            <Icon name="users" />
          </span>
          <div>
            <h1>ผู้ใช้งานระบบ (Users)</h1>
            <p>จัดการบัญชีผู้ใช้ บทบาท ข้อมูลติดต่อ และสถานะการใช้งาน</p>
          </div>
        </div>
        <button className="au-add" onClick={create}>
          <Icon name="users" />
          เพิ่มผู้ใช้
        </button>
      </div>
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
          <button className="ghost" onClick={() => setRevision((r) => r + 1)}>
            ลองใหม่
          </button>
        </p>
      )}
      <div className="au-stats">
        {[
          {
            label: "ผู้ใช้ทั้งหมด",
            value: data?.stats.total,
            icon: "users",
            note: "บัญชีภายในขอบเขตที่คุณจัดการได้",
            color: "green",
          },
          {
            label: "ใช้งาน",
            value: data?.stats.active,
            icon: "active",
            note: "บัญชีที่เปิดให้เข้าสู่ระบบ",
            color: "blue",
          },
          {
            label: "ระงับการใช้งาน",
            value: data?.stats.suspended,
            icon: "lock",
            note: "บัญชีที่ไม่อนุญาตให้เข้าสู่ระบบ",
            color: "amber",
          },
          {
            label: "ผู้ดูแลระบบ",
            value: data?.stats.admins,
            icon: "shield",
            note: "Admin ที่มีสถานะใช้งาน",
            color: "green",
          },
        ].map((x) => (
          <div className={"au-stat " + x.color} key={x.label}>
            <span className="au-stat-icon">
              <Icon name={x.icon} />
            </span>
            <p>{x.label}</p>
            <strong>
              {x.value === undefined ? "—" : x.value.toLocaleString("th-TH")}
              <small>บัญชี</small>
            </strong>
            <span className="au-note">{x.note}</span>
          </div>
        ))}
      </div>
      <section className="au-list">
        <div className="au-tabs">
          {[
            ["", "ทั้งหมด", data?.stats.total],
            ["active", "ใช้งาน", data?.stats.active],
            ["suspended", "ระงับการใช้งาน", data?.stats.suspended],
          ].map(([v, label, count]) => (
            <button
              key={String(v)}
              className={status === v ? "selected" : ""}
              onClick={() => {
                setStatus(String(v));
                setPage(1);
              }}
            >
              {label}
              <span>{count ?? "—"}</span>
            </button>
          ))}
        </div>
        <form
          className="au-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q);
            setPage(1);
            setRevision((r) => r + 1);
          }}
        >
          <div className="au-search">
            <Icon name="search" />
            <input
              aria-label="ค้นหาผู้ใช้งาน"
              placeholder="ชื่อผู้ใช้, ชื่อ-นามสกุล, อีเมล, โทรศัพท์, ตำแหน่ง…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            aria-label="กรองบทบาท"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">ทุกบทบาท</option>
            {userRoles.map((r) => (
              <option key={r} value={r}>
                {userRoleLabels[r]}
              </option>
            ))}
          </select>
          <select
            aria-label="กรองแผนก"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(1);
            }}
          >
            <option value="">ทุกแผนก</option>
            {data?.departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <button className="au-filter-button" disabled={loading}>
            <Icon name="filter" />
            กรอง
          </button>
        </form>
        <div className="au-result-count" role="status">
          {loading ? "กำลังโหลด…" : `${data?.total ?? 0} รายการ`}
        </div>
        {loading ? (
          <div className="au-empty">กำลังโหลดผู้ใช้งาน…</div>
        ) : !data?.items.length ? (
          <div className="au-empty">
            {error ? "โหลดข้อมูลไม่สำเร็จ" : "ไม่พบผู้ใช้งานตามเงื่อนไข"}
          </div>
        ) : (
          <div className="au-table-wrap">
            <table className="au-table">
              <thead>
                <tr>
                  <th>ผู้ใช้ / ชื่อ-นามสกุล</th>
                  <th>บทบาท</th>
                  <th>แผนก / ตำแหน่ง</th>
                  <th>โทรศัพท์</th>
                  <th>เข้าสู่ระบบล่าสุด</th>
                  <th>กิจกรรม</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((account) => (
                  <tr key={account._id}>
                    <td data-label="ผู้ใช้">
                      <div className="au-person">
                        <span className="au-avatar">
                          {initials(account.name)}
                        </span>
                        <div>
                          <strong>{account.name}</strong>
                          {account._id === currentUser._id && (
                            <span className="au-you">คุณ</span>
                          )}
                          <small>
                            {account.username}
                            {account.email && <> · {account.email}</>}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td data-label="บทบาท">
                      <span className={"au-role " + account.role}>
                        {userRoleLabels[account.role] || account.role}
                      </span>
                    </td>
                    <td data-label="แผนก / ตำแหน่ง">
                      <b>{account.department || "—"}</b>
                      <small>{account.position || "—"}</small>
                    </td>
                    <td data-label="โทรศัพท์">{account.phone || "—"}</td>
                    <td data-label="เข้าสู่ระบบล่าสุด">
                      {account.lastLoginAt ? (
                        <>
                          <span>{timeAgo(account.lastLoginAt)}</span>
                          <small>
                            {new Date(account.lastLoginAt).toLocaleString(
                              "th-TH",
                              {
                                timeZone: "Asia/Bangkok",
                                dateStyle: "medium",
                                timeStyle: "short",
                              },
                            )}
                          </small>
                        </>
                      ) : (
                        "ยังไม่มีข้อมูล"
                      )}
                    </td>
                    <td data-label="กิจกรรม">
                      <a
                        className="au-activity-count"
                        href={`/?${new URLSearchParams({view:"auditLogs",actor:account._id})}`}
                        title={`ดูประวัติการเปลี่ยนแปลงของ ${account.name}`}
                        aria-label={`ดูประวัติกิจกรรมของ ${account.name}`}
                      >
                        {(account.activityCount ?? 0).toLocaleString("th-TH")}
                      </a>
                    </td>
                    <td data-label="สถานะ">
                      <span
                        className={
                          "au-status " +
                          (account.active ? "active" : "suspended")
                        }
                      >
                        ● {account.active ? "ใช้งาน" : "ระงับการใช้งาน"}
                      </span>
                    </td>
                    <td>
                      <div className="au-row-actions">
                        <button
                          type="button"
                          className="au-edit"
                          title="แก้ไข"
                          aria-label={`แก้ไข ${account.name}`}
                          onClick={() => edit(account)}
                        >
                          <Icon name="edit" />
                        </button>

                        <button
                          type="button"
                          className="au-edit"
                          title={"ตั้งรหัสผ่านใหม่"}
                          aria-label={`ตั้งรหัสผ่านใหม่ ${account.name}`}
                          onClick={() => setPasswordTarget(account)}
                        >
                          <Icon name="key" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} total={data?.total || 0} count={data?.items.length || 0} loading={loading} onChange={setPage} />
      </section>
      <dialog
        ref={dialog}
        className="au-dialog"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) {
            const r = dialog.current.getBoundingClientRect();
            if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              close();
          }
        }}
        aria-labelledby="au-dialog-title"
      >
        {form && (
          <form onSubmit={save}>
            <div className="au-dialog-heading">
              <h2 id="au-dialog-title">
                {form.id ? "แก้ไขผู้ใช้งาน" : "เพิ่มผู้ใช้งาน"}
              </h2>
              <button
                type="button"
                className="au-close"
                disabled={busy}
                onClick={close}
                aria-label="ปิด"
              >
                <Icon name="close" />
              </button>
            </div>
            {formError && (
              <p className="error" role="alert">
                {formError}
              </p>
            )}
            <div className="au-form-grid">
              <label>
                User ID
                <input
                  required
                  maxLength={80}
                  value={form.username}
                  readOnly={Boolean(form.id)}
                  autoComplete="off"
                  onChange={(e) => field("username", e.target.value)}
                />
              </label>
              <label>
                ชื่อ-นามสกุล
                <input
                  required
                  maxLength={200}
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  maxLength={254}
                  value={form.email}
                  onChange={(e) => field("email", e.target.value)}
                />
              </label>
              <label>
                โทรศัพท์
                <input
                  type="tel"
                  maxLength={30}
                  value={form.phone}
                  onChange={(e) => field("phone", e.target.value)}
                />
              </label>
              <label>
                แผนก
                <input maxLength={120} value={form.department} onChange={e=>field("department",e.target.value)} />
              </label>
              <label>
                ตำแหน่ง
                <input
                  maxLength={120}
                  value={form.position}
                  onChange={(e) => field("position", e.target.value)}
                />
              </label>
              <label>
                บทบาท
                <select
                  disabled={self}
                  value={form.role}
                  onChange={(e) => field("role", e.target.value)}
                >
                  {userRoles.map((r) => (
                    <option key={r} value={r}>
                      {userRoleLabels[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                สถานะ
                <select
                  disabled={self}
                  value={form.active ? "active" : "suspended"}
                  onChange={(e) => field("active", e.target.value === "active")}
                >
                  <option value="active">ใช้งาน</option>
                  <option value="suspended">ระงับการใช้งาน</option>
                </select>
              </label>
              {
                <label className="au-wide">
                  {!form.id && (
                    <label className="au-wide">
                      รหัสผ่านเริ่มต้น
                      <input
                        type="password"
                        required
                        minLength={12}
                        maxLength={200}
                        autoComplete="new-password"
                        value={form.password}
                        onChange={(e) => field("password", e.target.value)}
                      />
                    </label>
                  )}
                </label>
              }
              <fieldset className="au-wide au-grants">
                <legend>บริษัท / สาขาที่เข้าถึงได้ *</legend>
                {availableSites.map((site) => {
                  const checked = form.grants.some(
                    (g) =>
                      g.companyId === site.companyId && g.siteId === site._id,
                  );
                  return (
                    <label key={site._id + site.companyId}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          field(
                            "grants",
                            e.target.checked
                              ? [
                                  ...form.grants,
                                  {
                                    companyId: site.companyId,
                                    siteId: site._id,
                                  },
                                ]
                              : form.grants.filter(
                                  (g) =>
                                    !(
                                      g.companyId === site.companyId &&
                                      g.siteId === site._id
                                    ),
                                ),
                          )
                        }
                      />
                      {site.companyId} · {site.name}
                    </label>
                  );
                })}
                {!availableSites.length && <p>ไม่พบสาขาที่คุณมีสิทธิ์จัดการ</p>}
              </fieldset>
            </div>
            <div className="au-form-actions">
              <button
                type="button"
                className="au-cancel"
                disabled={busy}
                onClick={close}
              >
                ยกเลิก
              </button>
              <button disabled={busy || !form.grants.length}>
                {busy ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
              </button>
            </div>
          </form>
        )}
      </dialog>
      {passwordTarget && (
        <AdminPasswordDialog
          account={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onSaved={() => {
            const requiresLogin = passwordTarget._id === currentUser._id;
            setPasswordTarget(null);
            setSuccess("เปลี่ยนรหัสผ่านสำเร็จ");
            setRevision((r) => r + 1);
            onSaved?.(requiresLogin);
          }}
        />
      )}
    </div>
  );
}

