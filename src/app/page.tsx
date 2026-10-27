"use client";
import Pagination, { useClientPagination } from "./Pagination";
import { useEffect, useRef, useState, FormEvent } from "react";
import { permitted, modules as permissionModules } from "@/lib/permissions";
import { guideCanOpen } from "@/lib/guide-data";
import dynamic from "next/dynamic";
import "./workspace.css";
import "./workspace-motion.css";
import "./workspace-cards.css";
import "./password-recovery.css";
import { labels, User, manager, inScope, canTransition } from "@/lib/domain";
import { displayDocumentNumber } from "@/lib/document-number";
import { TypewriterText, ParticleBackground } from "./LoginMotion";

const AttachmentGallery = dynamic(() => import("./AttachmentGallery"));
const Notifications = dynamic(() => import("./Notifications"));
const AdminUsers = dynamic(() => import("./AdminUsers"));
const PermissionMatrix = dynamic(() => import("./PermissionMatrix"));
const LdapSettings = dynamic(() => import("./LdapSettings"));
const SmtpSettings = dynamic(() => import("./SmtpSettings"));
const AssetEditor = dynamic(() => import("./AssetEditor"));
const SystemSettings = dynamic(() => import("./SystemSettings"));
const WorkTypes = dynamic(() => import("./WorkTypes"));
const MasterData = dynamic(() => import("./MasterData"));
const Companies = dynamic(() => import("./Companies"));
const Guide = dynamic(() => import("./Guide"));
const UserMenu = dynamic(() => import("./UserMenu"));
const ForgotPasswordDialog = dynamic(() => import("./ForgotPasswordDialog"));
const Dashboard = dynamic(() => import("./Dashboard"));
const InventoryWorkspace = dynamic(() => import("./inventory/Workspace"));
const PMWorkspace = dynamic(() => import("./pm/advanced/Workspace"));
const AuditHistory = dynamic(() => import("./AuditHistory"));

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    inventory: "M3 7l9-5 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10 M7.5 4.5l9 5v4",
    dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    repairRequests: "M8 3h8v4H8z M7 5H5v16h14V5h-2 M8 12h8 M8 16h5",
    workOrders: "M8 12l3 3 5-6 M4 4h16v16H4z",
    assets: "M4 7h16v14H4z M8 7V3h8v4 M4 12h16 M10 12v3h4v-3",
    notifications: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
    locations:
      "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z M9 10a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
    users:
      "M9 11a4 4 0 1 0 0-8a4 4 0 1 0 0 8 M2 21v-3a7 7 0 0 1 14 0v3 M17 4a4 4 0 0 1 0 8 M20 21v-3a7 7 0 0 0-2-5",
    auditLogs: "M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2",
    flow:
      "M9 3h6v5H9z M2 17h6v5H2z M16 17h6v5h-6z M12 8v5 M5 13h14 M5 13v4 M19 13v4",
    guide: "M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1v15",
    sites: "M4 21V3h12v18 M16 9h4v12 M7 7h2 M11 7h2 M7 11h2 M11 11h2 M9 21v-6h4v6",
    workTypes: "M4 4h7v7H4z M14 4h6v7h-6z M4 14h7v6H4z M14 14h6v6h-6z",
    settings: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
    smtp: "M3 5h18v14H3z M3 6l9 7 9-7",
    profile: "M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8 M4 22v-2a8 8 0 0 1 16 0v2",
    menu: "M3 6h18 M3 12h18 M3 18h18",
    close: "M6 6l12 12 M18 6 6 18",
    logout: "M9 3H3v18h6 M9 12h12 M17 8l4 4-4 4",
    eyeOff:
      "M3 3l18 18 M10.6 10.6a2 2 0 0 0 2.8 2.8 M9.9 5.2A12 12 0 0 1 12 5c7 0 10 7 10 7a16 16 0 0 1-3.3 4.3 M6.2 6.2A17 17 0 0 0 2 12s3 7 10 7a12 12 0 0 0 5.8-1.8",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.assets} />
    </svg>
  );
}

function WorkspaceClock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const update = () =>
      setNow(
        new Date().toLocaleString("th-TH", {
          timeZone: "Asia/Bangkok",
          dateStyle: "medium",
          timeStyle: "short",
        }),
      );
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);
  return <time className="workspace-clock">{now}</time>;
}

function AttachmentPreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return (
    <div className="attachment-row">
      {url ? <img src={url} alt={file.name} /> : <Icon name="repairRequests" />}
      <span>
        {file.name}
        <small>{(file.size / 1024).toFixed(0)} KB</small>
      </span>
      <button
        type="button"
        className="ghost"
        onClick={onRemove}
        aria-label={"นำไฟล์ออก " + file.name}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

function createUUID(): string {
  if (typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  const bytes = window.crypto.getRandomValues(new Uint8Array(16));

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

type R = Record<string, any>;
async function api(path: string, body?: unknown) {
  const res = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers:
      body instanceof FormData ? {} : { "Content-Type": "application/json" },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
  return data;
}
const date = (s: string) =>
  new Date(s).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
function Counter({ value }: { value: number }) {
  const [n, set] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      set(value);
      return;
    }
    const start = performance.now();
    let id = 0;
    function frame(t: number) {
      const k = Math.min((t - start) / 600, 1);
      set(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) id = requestAnimationFrame(frame);
    }
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return <strong>{n.toLocaleString("th-TH")}</strong>;
}
function Badge({ status }: { status: string }) {
  return <span className={"badge " + status}>{labels[status] || status}</span>;
}
function Input({
  name,
  label,
  type = "text",
  required = true,
  ...rest
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  [key: string]: any;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} required={required} {...rest} />
    </label>
  );
}
export default function App() {
  const loadSequence = useRef(0);
  const [notificationOpenVersion, setNotificationOpenVersion] = useState(0);
  const [assetCompany, setAssetCompany] = useState("");
  const [assetSite, setAssetSite] = useState("");
  const [assetLocation, setAssetLocation] = useState("");
  const [auditActor, setAuditActor] = useState("");
  const [auditModuleFilter, setAuditModuleFilter] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [loginCompany, setLoginCompany] = useState("");
  const [u, setU] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [view, setView] = useState("dashboard"),
    [selected, setSelected] = useState<string | null>(null),
    [rows, setRows] = useState<R[]>([]),
    [detail, setDetail] = useState<R | null>(null),
    [stats, setStats] = useState<R>({}),
    [look, setLook] = useState<R>({
    sites: [],
      locations: [],
      assets: [],
      technicians: [],
      workTypes: [],
    }),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [site, setSite] = useState(""),
    [location, setLocation] = useState(""),
    [asset, setAsset] = useState(""),
    [pendingFiles, setPendingFiles] = useState<File[]>([]),
    [key, setKey] = useState(""),
    [qr, setQr] = useState(""),
    [logKey, setLogKey] = useState("");
  useEffect(() => {
    api("me")
      .then(setU)
      .catch(() => {})
      .finally(() => setBoot(false));
    setKey(createUUID());
    setLogKey(createUUID());
  }, []);
  useEffect(() => {
    if (u) return;
    const controller = new AbortController();
    fetch("/api/login-branding", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const branding = await response.json();
        if (
          !controller.signal.aborted &&
          typeof branding.companyNameTh === "string"
        )
          setLoginCompany(branding.companyNameTh);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [u]);
  useEffect(() => {
    if (u) {
      api("lookups")
        .then((x) => {
          setLook(x);
          if (!site) setSite(x.sites[0]?._id || "");
        })
        .catch((e) => setError(e.message));
    }
  }, [u]);
  useEffect(() => {
    if (!u) return;
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view");
    if (requestedView && guideCanOpen(u.role, requestedView) && (!permissionModules.some(([key]) => key === requestedView) || permitted(u, requestedView))) {
      setAuditActor(
        requestedView === "auditLogs" ? params.get("actor") || "" : "",
      );
      setAuditModuleFilter(
        requestedView === "auditLogs" ? params.get("module") || "" : "",
      );
      setView(requestedView);
      setStatus(
        ["repairRequests", "workOrders"].includes(requestedView) &&
          (labels[params.get("status") || ""] || (requestedView === "workOrders" && ["outstanding", "overdue", "waiting"].includes(params.get("status") || "")))
          ? params.get("status") || ""
          : "",
      );
      setPage(1);
      setSelected(requestedView === "pm" ? params.get("job") : null);
      setDetail(null);
    }
  }, [u]);
  const assetPages = useClientPagination(rows, view);
  async function load() {
    if (!u) return;
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    try {
      if (view === "dashboard") return;
      else if (view === "new") return;
      else if (view === "notifications" || view === "inventory" || view === "pm") return;
      else if (
        view === "ldap" ||
        view === "smtp" ||
        view === "roles" ||
        view === "profile" ||
        view === "users" ||
        view === "auditLogs" ||
        view === "settings" ||
        view === "guide" ||
        view === "flow" ||
        view === "workTypes" ||
        view === "companies" ||
        ["sites","locations"].includes(view)
      )
        return;
      else if (selected) {
        const x = await api(view + "/" + selected);
        if (sequence !== loadSequence.current) return;
        setDetail(x);
        if (view === "assets") {
          const QRCode = (await import("qrcode")).default;
          const image = await QRCode.toDataURL(locationOrigin() + "/?asset=" + x._id);
          if (sequence === loadSequence.current) setQr(image);
        }
      } else {
        const x = await api(
          view + "?" + new URLSearchParams({ q, status, page: String(page) }),
        );
        if (sequence !== loadSequence.current) return;
        setRows(Array.isArray(x) ? x : x.items);
        setTotal(x.total || 0);
      }
    } catch (e) {
      if (sequence === loadSequence.current) setError((e as Error).message);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    load();
    return () => { loadSequence.current++; };
  }, [u, view, selected, page, status, notificationOpenVersion]);
  useEffect(() => {
    if (u && look.assets.length) {
      const a = new URLSearchParams(window.location.search).get("asset");
      if (a) {
        const r = look.assets.find((x: R) => x._id === a);
        if (r) {
          setView("assets");
          setSelected(a);
        } else setError("ไม่พบเครื่องจักรหรือไม่มีสิทธิ์เข้าถึง");
      }
    }
  }, [u, look.assets.length]);
  function nav(v: string) {
    if (!u || !guideCanOpen(u.role, v)) return;
    const target = v === "new" ? "repairRequests" : v;
    if (permissionModules.some(([module]) => module === target) && !permitted(u, target, v === "new" ? "create" : "view")) {
      setError("ไม่มีสิทธิ์เปิดหน้านี้ตามบทบาท & สิทธิ์");
      return;
    }
    setMenuOpen(false);
    setSuccess("");
    setError("");
    setView(v);
    setAuditActor("");
    setAuditModuleFilter("");
    const url = new URL(window.location.href);
    url.searchParams.delete("actor");
    url.searchParams.delete("module");
    url.searchParams.delete("status");
    url.searchParams.delete("asset");
    url.searchParams.delete("job");
    url.searchParams.set("view", v);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    setSelected(null);
    setDetail(null);
    setRows([]);
    setPage(1);
    setStatus("");
    setQ("");
    setError("");
    setSuccess("");
  }
  function openNotification(module: string, id?: string) {
    if (!u || !guideCanOpen(u.role, module)) return;
    const permission = module === "roles" ? "users" : module;
    if (permissionModules.some(([key]) => key === permission) && !permitted(u, permission)) {
      setError("ไม่มีสิทธิ์เปิดรายการนี้");
      return;
    }
    nav(module);
    if (id && ["repairRequests", "workOrders", "assets", "pm"].includes(module)) {
      loadSequence.current++;
      setLoading(true);
      setSelected(id);
      setNotificationOpenVersion(version => version + 1);
    }
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function values(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  }
  async function change(next: string, e?: FormEvent<HTMLFormElement>) {
    let v: R = {};
    if (e) v = values(e);
    if (
      ["cancelled", "rejected"].includes(next) &&
      !confirm("ยืนยัน " + labels[next] + "?")
    )
      return;
    await run(async () => {
      await api(view + "/" + selected + "/transition", {
        ...v,
        next,
        assigneeIds: v.assigneeIds ? [v.assigneeIds] : undefined,
        dueAt: v.dueAt ? new Date(v.dueAt + "+07:00").toISOString() : undefined,
        rating: v.rating ? Number(v.rating) : undefined,
      });
      setSuccess("บันทึกสถานะสำเร็จ");
      await load();
    });
  }
  if (boot)
    return (
      <main className="login">
        <p>กำลังตรวจสอบการเข้าสู่ระบบ…</p>
      </main>
    );
  if (!u)
    return (
      <main className="login login-split">
        <section className="login-story login-motion">
          <ParticleBackground />
          <div className="brand">
            <span className="brand-mark brand-logo">
              <img src="/age-logo.svg" alt="โลโก้บริษัท AGE" width={46} height={46} />
            </span>
            <div>
              AGE CMMS<small>MAINTENANCE MANAGEMENT</small>
            </div>
          </div>
          <div className="story-copy">
            <p className="story-pill">ศูนย์กลางงานซ่อมบำรุงขององค์กร</p>
            <h1>
              ดูแลอาคาร
              <br />
              และเครื่องจักร
              <br />
              <TypewriterText
                phrases={[
                  "จัดการงานแจ้งซ่อม",
                  "ติดตามงานช่าง",
                  "ดูแลเครื่องจักร",
                  "วางแผนงานบำรุงรักษา",
                ]}
              />
            </h1>
            <p>
              แจ้งซ่อม มอบหมายงาน และติดตามผล
              <br />
              เชื่อมทุกขั้นตอนให้ทีมทำงานร่วมกันได้สะดวก
            </p>
          </div>
          <div className="story-flow">
            <span>
              <Icon name="repairRequests" />
              แจ้งซ่อม
            </span>
            <span>
              <Icon name="workOrders" />
              ดำเนินงาน
            </span>
            <span>
              <Icon name="auditLogs" />
              ติดตามผล
            </span>
          </div>
          <small className="story-footer">
            AGE CMMS · BUILDING & FACTORY MAINTENANCE
          </small>
        </section>
        <div className="login-form-side">
          <div className="login-card">
            <p className="eyebrow">AGE CMMS / SIGN IN</p>
            <h1>ยินดีต้อนรับ</h1>
            <p className="muted">
              เข้าสู่ระบบศูนย์งานซ่อมบำรุง
              {loginCompany ? ` ${loginCompany}` : ""}
            </p>
            <form
              id="login-form"
              method="post"
              action="/api/login"
              autoComplete="on"
              onSubmit={(e) => {
                const v = values(e);
                run(async () => {
                  await api("login", v);
                  const loggedIn = await api("me");
                  setShowPassword(false);
                  setU(loggedIn);
                });
              }}
            >
              <Input
                name="username"
                id="login-username"
                autoCapitalize="none"
                spellCheck={false}
                label="ชื่อผู้ใช้"
                autoComplete="username"
              />
              <div>
                <div className="login-password-heading">
                  <label htmlFor="login-password">รหัสผ่าน</label>
                  <a href="#forgot-password" className="forgot-password-link" aria-haspopup="dialog" onClick={(event)=>{event.preventDefault();setForgotPassword(true);}}>ลืมรหัสผ่าน?</a>
                </div>
                <div className="password-field">
                  <input
                    name="password"
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    aria-pressed={showPassword}
                  >
                    <Icon name={showPassword ? "eyeOff" : "eye"} />
                  </button>
                </div>
              </div>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button disabled={busy}>
                {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ →"}
              </button>
            </form>
            <div className="login-trust">
              <Icon name="users" size={16} />
              <small>เข้าถึงข้อมูลตามบทบาทและขอบเขตสิทธิ์ของคุณ</small>
            </div>
            <small className="login-footer">AGE CMMS · ใช้งานออนไลน์</small>
          </div>
        </div>
        {forgotPassword && <ForgotPasswordDialog onClose={()=>setForgotPassword(false)} />}
      </main>
    );
  const titles: Record<string, string> = {
    inventory: "คลังอะไหล่",
    pm: "บำรุงรักษา PM",
    dashboard: "แดชบอร์ด",
    repairRequests: "ใบแจ้งซ่อม",
    workOrders: u.role === "technician" ? "งานของฉัน" : "ใบงานซ่อม",
    assets: "ทะเบียนเครื่องจักร",
    new: "แจ้งซ่อมใหม่",
    notifications: "การแจ้งเตือน",
    locations: "สถานที่",
    users: "จัดการผู้ใช้",
    roles: "บทบาท & สิทธิ์",
    ldap: "ตั้งค่า LDAP / AD",
    smtp: "ตั้งค่า SMTP",
    profile: "โปรไฟล์ของฉัน",
    auditLogs: "ประวัติการเปลี่ยนแปลง",
    settings: "ตั้งค่าระบบ",
    workTypes: "ประเภทงาน",
    sites: "อาคาร/โรงงาน/สาขา",
    companies: "บริษัท",
    guide: "คู่มือ",
    flow: "Flow ระบบ",
  };
  const menu = [
    "inventory",
    "pm",
    "dashboard",
    "repairRequests",
    "workOrders",
    "assets",
    "notifications",
    "guide",
    "flow",
    
    ...(u.role === "admin" ? ["users", "roles", "ldap", "smtp", "auditLogs", "settings", "workTypes", "companies", "sites", "locations"] : []),
  ];
  const visibleMenu = menu.filter(key => !permissionModules.some(([module]) => module === key) || permitted(u, key));
  const menuGroups = [
            {
              id: "maintenance",
              label: "งานซ่อมบำรุง",
              items: ["repairRequests", "workOrders", "pm", "inventory"],
            },
            {
              id: "masters",
              label: "ข้อมูลหลัก",
              items: ["companies", "sites", "locations", "assets", "workTypes"],
            },
            {
              id: "system",
              label: "ระบบและผู้ใช้งาน",
              items: ["notifications", "users", "roles", "ldap", "smtp", "auditLogs", "settings"],
            },
            {
              id: "help",
              label: "คู่มือการใช้งาน",
              items: ["guide", "flow"],
            },
          ];
  const currentGroup = menuGroups.find(group => group.items.includes(view))?.label;
  return (
    <div
      className={"shell erp-shell" + (collapsed ? " sidebar-collapsed" : "")}
    >
      {menuOpen && (
        <button
          className="nav-backdrop"
          aria-label="ปิดเมนู"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside id="main-navigation" className={menuOpen ? "is-open" : ""}>
        <div className="brand">
          <span className="brand-mark brand-logo">
            <img src="/age-logo.svg" alt="โลโก้บริษัท AGE" width={46} height={46} />
          </span>
          <div>
            AGE CMMS<small>ศูนย์งานซ่อมบำรุง</small>
          </div>
        </div>
        <button
          className="mobile-close ghost"
          onClick={() => setMenuOpen(false)}
          aria-label="ปิดเมนู"
        >
          <Icon name="close" />
        </button>
        <button
          className="desktop-collapse ghost"
          title={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
          aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon name="menu" size={18} />
        </button>
        <label className="menu-search">
          <span className="sr-only">ค้นหาเมนู</span>
          <input
            placeholder="ค้นหาเมนู…"
            value={menuQuery}
            onChange={(e) => setMenuQuery(e.target.value)}
          />
        </label>
        <nav aria-label="เมนูหลัก">
          <button
            data-menu="dashboard"
            className={view === "dashboard" ? "active" : ""}
            onClick={() => nav("dashboard")}
            title={titles.dashboard}
          >
            <Icon name="dashboard" />
            <span className="nav-label">{titles.dashboard}</span>
          </button>
          {menuGroups.map((group) => {
            const items = group.items.filter(
              (v) => visibleMenu.includes(v) && (titles[v] ?? v).includes(menuQuery),
            );
            if (!items.length) return null;
            const open = Boolean(menuQuery) || !closedGroups.includes(group.id);
            return (
              <div className="nav-group" key={group.id}>
                <button
                  className="nav-group-heading"
                  aria-expanded={open}
                  aria-controls={"nav-" + group.id}
                  onClick={() =>
                    setClosedGroups((groups) =>
                      open
                        ? [...groups, group.id]
                        : groups.filter((id) => id !== group.id),
                    )
                  }
                >
                  <span className="nav-label">{group.label}</span>
                  <span className="group-chevron">{open ? "−" : "+"}</span>
                </button>
                <div id={"nav-" + group.id} hidden={!open && !collapsed}>
                  {items.map((v) => (
                    <button
                      key={v}
                      data-menu={v}
                      title={titles[v]}
                      className={view === v ? "active" : ""}
                      aria-current={view === v ? "page" : undefined}
                      onClick={() => nav(v)}
                    >
                      <Icon name={v} size={18} />
                      <span className="nav-label">{titles[v]}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="aside-note">
          <span className="online-dot" />
          <span className="nav-label">
            AGE CMMS<small>ระบบออนไลน์ · ข้อมูลตามสิทธิ์</small>
          </span>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <button
            className="mobile-menu ghost"
            aria-label="เปิดเมนู"
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name="menu" />
          </button>
          <div className="header-context">
            <button
              className="ghost breadcrumb-home"
              onClick={() => nav("dashboard")}
              aria-label="กลับหน้าภาพรวม"
            >
              <Icon name="dashboard" size={16} />
            </button>
            {currentGroup && <><span className="breadcrumb-divider">/</span><span>{currentGroup}</span></>}
            <span className="breadcrumb-divider">/</span>
            <strong>{titles[view]}</strong>
          </div>
          <div className="header-actions">
            <WorkspaceClock />
            <Notifications key={u._id} userId={u._id} onOpen={openNotification} />
            <UserMenu
              user={u}
              busy={busy}
              onProfile={() => nav("profile")}
              onNotifications={() => nav("notifications")}
              onGuide={() => nav("guide")}
              onFlow={() => nav("flow")}
              onSettings={() => nav("settings")}
              onLogout={() =>
                run(async () => {
                  await api("logout", {});
                  setU(null);
                })
              }
            />
          </div>
        </header>
        <main className={view === "dashboard" ? "dashboard-main" : undefined}>
          <div
            className="page-heading"
            hidden={["pm", "dashboard", "ldap", "smtp", "roles", "users", "settings", "guide", "flow", "workTypes", "companies", "sites", "locations"].includes(view)}
            style={
              ["pm", "dashboard", "ldap", "smtp", "roles", "users", "settings", "guide", "flow", "workTypes", "companies", "sites", "locations"].includes(view)
                ? { display: "none" }
                : undefined
            }
          >
            <div>
              <p className="eyebrow">
                MAINTENANCE / {selected ? "DETAIL" : "OVERVIEW"}
              </p>
              <h1>
                <span className="heading-icon">
                  <Icon name={view} size={24} />
                </span>
                {titles[view]}
              </h1>
              {view !== "inventory" && view !== "pm" && <p className="muted">
                {selected
                  ? (detail?.number ? displayDocumentNumber(detail.number) : detail?.name)
                  : "ติดตามงาน ดูแลทรัพย์สิน และทำงานร่วมกันในที่เดียว"}
              </p>}
            </div>
            {view !== "inventory" && view !== "pm" && u.role !== "executive" && (
              <button onClick={() => nav("new")}>＋ แจ้งซ่อม</button>
            )}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="success">
              {success}
            </p>
          )}
          {loading ? (
            <div className="panel loading-state" role="status">
              <span className="loading-spinner" />
              กำลังโหลดข้อมูล…
            </div>
          ) : (
            <>
              {view === "inventory" && permitted(u, "inventory") && <InventoryWorkspace />}
              {view === "pm" && permitted(u, "pm") && <PMWorkspace jobId={selected} headingIcon={<Icon name="pm" size={24} />} />}
              {view === "ldap" && u.role === "admin" && <LdapSettings />}
              {view === "roles" && u.role === "admin" && <PermissionMatrix onSaved={() => { api("me").then(setU).catch(e => setError(e.message)); }} />}
              {view === "dashboard" && (
                <Dashboard
                  user={u}
                  onNavigate={(v, filter) => {
                    nav(v);
                    if (filter) {
                      setStatus(filter);
                      const url = new URL(window.location.href);
                      url.searchParams.set("status", filter);
                      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
                    }
                  }}
                  onOpen={(v, id) => {
                    nav(v);
                    setSelected(id);
                  }}
                />
              )}
              {view === "new" && (
                <form
                  className="panel form-grid"
                  onSubmit={(e) => {
                    const v = values(e),
                      s = look.sites.find((x: R) => x._id === site);
                    run(async () => {
                      const r = await api("repairRequests", {
                        ...v,
                        companyId: s.companyId,
                        siteId: site,
                        locationId: location,
                        assetId: asset || undefined,
                        stopped: v.stopped === "on",
                        discoveredAt: new Date(
                          String(v.discoveredAt) + "+07:00",
                        ).toISOString(),
                        idempotencyKey: key,
                      });
                      setKey(createUUID());
                      setSuccess("สร้าง " + displayDocumentNumber(r.number) + " สำเร็จ");
                      setView("repairRequests");
                      setSelected(r._id);
                      if (pendingFiles.length > 5) throw new Error("\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e44\u0e14\u0e49\u0e04\u0e23\u0e31\u0e49\u0e07\u0e25\u0e30\u0e44\u0e21\u0e48\u0e40\u0e01\u0e34\u0e19 5 \u0e44\u0e1f\u0e25\u0e4c");
                      for (const file of pendingFiles) {
                        const fd = new FormData();
                        fd.set("file", file);
                        fd.set("parentKind", "repairRequests");
                        fd.set("parentId", r._id);
                        try {
                          await api("attachments", fd);
                        } catch (e) {
                          throw new Error(
                            "สร้าง " +
                              displayDocumentNumber(r.number) +
                              " แล้ว แต่แนบไฟล์ไม่สำเร็จ: " +
                              (e as Error).message +
                              " กรุณาอัปโหลดซ้ำในรายละเอียด",
                          );
                        }
                      }
                      setPendingFiles([]);
                      setDetail(await api("repairRequests/" + r._id));
                    });
                  }}
                >
                  <label>
                    กลุ่มงาน
                    <select name="type">
                      <option value="building">งานอาคาร</option>
                      <option value="factory">งานโรงงาน</option>
                    </select>
                  </label>
                  <label>
                    บริษัท / สาขา
                    <select
                      required
                      value={site}
                      onChange={(e) => {
                        setSite(e.target.value);
                        setLocation("");
                        setAsset("");
                      }}
                    >
                      <option value="">เลือกสาขา</option>
                      {look.sites.map((s: R) => (
                        <option key={s._id} value={s._id}>
                          {s.companyId} / {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    สถานที่
                    <select
                      required
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setAsset("");
                      }}
                    >
                      <option value="">เลือกสถานที่</option>
                      {look.locations
                        .filter((x: R) => x.siteId === site)
                        .map((x: R) => (
                          <option key={x._id} value={x._id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    เครื่องจักร / อุปกรณ์
                    <select
                      value={asset}
                      onChange={(e) => setAsset(e.target.value)}
                    >
                      <option value="">ไม่ระบุ (งานอาคาร)</option>
                      {look.assets
                        .filter(
                          (x: R) =>
                            x.siteId === site && x.locationId === location,
                        )
                        .map((x: R) => (
                          <option key={x._id} value={x._id}>
                            {x.code} • {x.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Input name="title" label="หัวข้อปัญหา" />
                  <label>
                    ประเภทงาน
                    <select name="workTypeId" key={`work-type-${site}`} required defaultValue="">
                      <option value="">เลือกประเภทงาน</option>
                      {(look.workTypes || []).filter((item:R)=>item.siteId===site&&item.companyId===look.sites.find((branch:R)=>branch._id===site)?.companyId).map((item:R)=><option key={item._id} value={item._id}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="wide">
                    รายละเอียด
                    <textarea name="description" required rows={4} />
                  </label>
                  <label>
                    ความเร่งด่วน
                    <select name="priority">
                      <option value="normal">ปกติ</option>
                      <option value="high">เร่งด่วน</option>
                      <option value="urgent">ฉุกเฉิน</option>
                    </select>
                  </label>
                  <Input
                    name="discoveredAt"
                    label="พบปัญหาเมื่อ"
                    type="datetime-local"
                    defaultValue={new Date(Date.now() + 7 * 3600000)
                      .toISOString()
                      .slice(0, 16)}
                  />
                  <Input name="department" required={false} value={u.department || ""} readOnly label="แผนก" />
                  <Input name="requesterName" label="ชื่อผู้แจ้ง" required={false} value={u.name || ""} readOnly />
                  <Input name="contact" label="ช่องทางติดต่อ" />
                  <Input name="impact" label="ผลกระทบ" />
                  <label className="checkbox">
                    <input name="stopped" type="checkbox" />
                    เครื่องจักรหยุดทำงาน
                  </label>
                  <label className="wide">
                    รูปจากกล้อง / เอกสารแนบ
                    <input
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      capture="environment"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 5) {
                          setError("\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e44\u0e14\u0e49\u0e04\u0e23\u0e31\u0e49\u0e07\u0e25\u0e30\u0e44\u0e21\u0e48\u0e40\u0e01\u0e34\u0e19 5 \u0e44\u0e1f\u0e25\u0e4c");
                          e.target.value = "";
                          setPendingFiles([]);
                          return;
                        }
                        setPendingFiles(files);
                      }}
                    />
                    <small>{"\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e44\u0e14\u0e49\u0e04\u0e23\u0e31\u0e49\u0e07\u0e25\u0e30\u0e44\u0e21\u0e48\u0e40\u0e01\u0e34\u0e19 5 \u0e44\u0e1f\u0e25\u0e4c"} (JPG, PNG, PDF / 8 MB)</small>
                  </label>
                  {pendingFiles.length > 0 && (
                    <div
                      className="wide attachment-list attachment-preview-grid"
                      aria-label="ไฟล์ที่เตรียมแนบ"
                    >
                      {pendingFiles.map((file, index) => (
                        <AttachmentPreview
                          key={`${file.name}-${file.lastModified}-${index}`}
                          file={file}
                          onRemove={() =>
                            setPendingFiles((files) =>
                              files.filter((_, i) => i !== index),
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                  <button className="wide repair-request-submit" disabled={busy}>
                    {busy ? "กำลังบันทึก…" : "บันทึกใบแจ้งซ่อม"}
                  </button>
                </form>
              )}
              {selected &&
                detail &&
                ["repairRequests", "workOrders"].includes(view) && (
                  <>
                    <button
                      className="ghost"
                      onClick={() => {
                        setSelected(null);
                        setDetail(null);
                      }}
                    >
                      ← กลับรายการ
                    </button>
                    <div className="detail-grid">
                      <section className="panel">
                        <Badge status={detail.status} />
                        <h2>{detail.title}</h2>
                        <p>{detail.description}</p>
                        {view === "repairRequests" && (
                          <p>
                            ชื่อผู้แจ้ง: {detail.requesterName || "ไม่ระบุ"} • ช่องทางติดต่อ: {detail.contact || "ไม่ระบุ"} • แผนก: {detail.department || "ไม่ระบุ"}
                          </p>
                        )}
                        <dl>
                          <dt>เลขเอกสาร</dt>
                          <dd>{displayDocumentNumber(detail.number)}</dd>
                          {detail.category&&<><dt>ประเภทงาน</dt><dd>{detail.category}</dd></>}
                          {view === "repairRequests" && (
                            <>
                              <dt>ความเร่งด่วน</dt>
                              <dd>{{ urgent: "ฉุกเฉิน", high: "เร่งด่วน", normal: "ปกติ" }[detail.priority as string] || "ไม่ระบุ"}</dd>
                              <dt>ผลกระทบ</dt>
                              <dd>{detail.impact || "ไม่ระบุ"}</dd>
                            </>
                          )}
                          <dt>สถานที่</dt>
                          <dd>
                            {
                              look.locations.find(
                                (x: R) => x._id === detail.locationId,
                              )?.name
                            }
                          </dd>
                          <dt>เครื่องจักร</dt>
                          <dd>
                            {look.assets.find(
                              (x: R) => x._id === detail.assetId,
                            )?.name || "ไม่ระบุ"}
                          </dd>
                          <dt>สร้างเมื่อ</dt>
                          <dd>{date(detail.createdAt)}</dd>
                          {detail.dueAt && (
                            <>
                              <dt>ครบกำหนด</dt>
                              <dd>{date(detail.dueAt)}</dd>
                              <dt>ต้นทุนรวม</dt>
                              <dd>
                                {(
                                  (detail.costSatang || 0) / 100
                                ).toLocaleString("th-TH")}{" "}
                                บาท
                              </dd>
                            </>
                          )}
                        </dl>
                        {detail.orders?.map((o: R) => (
                          <button
                            className="secondary"
                            key={o._id}
                            onClick={() => {
                              setView("workOrders");
                              setSelected(o._id);
                              setDetail(null);
                            }}
                          >
                            {displayDocumentNumber(o.number)} • {labels[o.status]} →
                          </button>
                        ))}
                        {view === "workOrders" && <AttachmentGallery key={`request-${selected}`} attachments={detail.requestAttachments || []} />}
                        <AttachmentGallery key={selected} attachments={detail.attachments || []} title={view === "workOrders" ? "\u0e20\u0e32\u0e1e\u0e1b\u0e23\u0e30\u0e01\u0e2d\u0e1a\u0e1c\u0e25\u0e01\u0e32\u0e23\u0e0b\u0e48\u0e2d\u0e21" : undefined} />
                        {detail.attachments?.filter((a: R) => !["image/jpeg", "image/png"].includes(a.type)).map((a: R) => (
                          <button
                            className="ghost"
                            key={a._id}
                            onClick={() =>
                              run(async () => {
                                const r = await api("attachments/" + a._id);
                                window.open(r.url, "_blank", "noopener");
                              })
                            }
                          >
                            {a.name} ↗
                          </button>
                        ))}
                        {!["executive"].includes(u.role) &&
                          ![
                            "closed",
                            "completed",
                            "cancelled",
                            "rejected",
                          ].includes(detail.status) && (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.currentTarget;
                                run(async () => {
                                  const files = pendingFiles;
                                  if (files.length > 5) throw new Error("\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e44\u0e14\u0e49\u0e04\u0e23\u0e31\u0e49\u0e07\u0e25\u0e30\u0e44\u0e21\u0e48\u0e40\u0e01\u0e34\u0e19 5 \u0e44\u0e1f\u0e25\u0e4c");
                                  for (const f of files) {
                                    const fd = new FormData();
                                    fd.set("parentKind", view);
                                    fd.set("parentId", selected);
                                    fd.set("file", f);
                                    await api("attachments", fd);
                                  }
                                  setPendingFiles([]);
                                  form.reset();
                                  setSuccess("แนบไฟล์สำเร็จ");
                                  await load();
                                });
                              }}
                            >
                              <input
                                name="files"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (files.length > 5) {
                                    setError("\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e44\u0e14\u0e49\u0e04\u0e23\u0e31\u0e49\u0e07\u0e25\u0e30\u0e44\u0e21\u0e48\u0e40\u0e01\u0e34\u0e19 5 \u0e44\u0e1f\u0e25\u0e4c");
                                    e.target.value = "";
                                    setPendingFiles([]);
                                    return;
                                  }
                                  setPendingFiles(files);
                                }}
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,application/pdf"
                                capture="environment"
                              />
                              {pendingFiles.length > 0 && <div className="attachment-list attachment-preview-grid">
                                {pendingFiles.map((file,index)=><AttachmentPreview key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={()=>setPendingFiles(files=>files.filter((_,i)=>i!==index))}/>)}
                              </div>}
                              <button disabled={busy}>อัปโหลดไฟล์</button>
                              <small>{"\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e44\u0e14\u0e49\u0e04\u0e23\u0e31\u0e49\u0e07\u0e25\u0e30\u0e44\u0e21\u0e48\u0e40\u0e01\u0e34\u0e19 5 \u0e44\u0e1f\u0e25\u0e4c"} (JPG, PNG, PDF / 8 MB)</small>
                            </form>
                          )}
                        <h3>ความคิดเห็น</h3>
                        {detail.comments?.map((c: R) => (
                          <div className="timeline" key={c._id}>
                            <b>{c.authorName}</b>
                            <p>{c.message}</p>
                            <small>{date(c.at)}</small>
                          </div>
                        ))}
                        {u.role !== "executive" && (
                          <form
                            onSubmit={(e) => {
                              const v = values(e),
                                f = e.currentTarget;
                              run(async () => {
                                await api(
                                  view + "/" + selected + "/comments",
                                  v,
                                );
                                f.reset();
                                await load();
                              });
                            }}
                          >
                            <textarea
                              name="message"
                              required
                              placeholder="ความคิดเห็น / คำถาม"
                            />
                            <button disabled={busy}>ส่งความคิดเห็น</button>
                          </form>
                        )}
                      </section>
                      <section className="panel">
                        <h2>ดำเนินการ</h2>
                        {view === "repairRequests" &&
                          detail.status === "pending" &&
                          manager(u) && (
                            <>
                              <button
                                style={{ width: "100%" }}
                                disabled={busy}
                                onClick={() => change("approved")}
                              >
                                อนุมัติและสร้างใบงาน
                              </button>
                              <form onSubmit={(e) => change("rejected", e)}>
                                <Input name="note" label="เหตุผลไม่อนุมัติ" />
                                <button className="danger" disabled={busy}>
                                  ไม่อนุมัติ
                                </button>
                              </form>
                            </>
                          )}
                        {view === "repairRequests" &&
                          detail.status === "pending" &&
                          (manager(u) || detail.requesterId === u._id) && (
                            <form onSubmit={(e) => change("cancelled", e)}>
                              <Input name="note" label="เหตุผลยกเลิก" />
                              <button className="secondary" disabled={busy}>
                                ยกเลิกคำขอ
                              </button>
                            </form>
                          )}
                        {view === "repairRequests" &&
                          detail.status === "awaiting_acceptance" &&
                          detail.requesterId === u._id && (
                            <form onSubmit={(e) => change("closed", e)}>
                              <label>
                                ความพึงพอใจ
                                <select name="rating">
                                  {[5, 4, 3, 2, 1].map((n) => (
                                    <option key={n} value={n}>
                                      {n} / 5
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button disabled={busy}>ยืนยันผลและปิดงาน</button>
                            </form>
                          )}
                        {view === "workOrders" &&
                          detail.status === "unassigned" &&
                          manager(u) && (
                            <form onSubmit={(e) => change("assigned", e)}>
                              <label>
                                ช่างหลัก
                                <select name="assigneeIds" required>
                                  <option value="">เลือกช่าง</option>
                                  {look.technicians
                                    .filter((t: R) =>
                                      t.grants.some(
                                        (g: R) =>
                                          g.companyId === detail.companyId &&
                                          g.siteId === detail.siteId,
                                      ),
                                    )
                                    .map((t: R) => (
                                      <option key={t._id} value={t._id}>
                                        {t.name}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <Input
                                name="dueAt"
                                label="กำหนดเสร็จ (เวลาไทย)"
                                type="datetime-local"
                                required={false}
                              />
                              <button disabled={busy}>มอบหมายงาน</button>
                            </form>
                          )}
                        {view === "workOrders" &&
                          [
                            "accepted",
                            "in_progress",
                            "waiting_parts",
                            "waiting_contractor",
                            "review",
                            "completed",
                          ]
                            .filter((next) =>
                              canTransition(
                                u,
                                detail as {
                                  status: string;
                                  assigneeIds: string[];
                                },
                                next,
                              ),
                            )
                            .map((next) =>
                              detail.status === "review" &&
                              next === "in_progress" ? (
                                <form
                                  key={next}
                                  onSubmit={(e) => change(next, e)}
                                >
                                  <Input name="note" label="เหตุผลส่งกลับ" />
                                  <button disabled={busy}>ส่งกลับแก้ไข</button>
                                </form>
                              ) : (
                                <button
                                  key={next}
                                  style={next === "completed" ? { width: "100%" } : undefined}
                                  className={["accepted", "in_progress", "waiting_parts", "waiting_contractor", "review"].includes(next) ? "secondary accept-work-button" : "secondary"}
                                  disabled={busy}
                                  onClick={() => change(next)}
                                >
                                  {next === "review"
                                    ? "ส่งตรวจรับ"
                                    : next === "accepted" ? "ยืนยันรับงาน" : labels[next]}
                                </button>
                              ),
                            )}
                        {view === "workOrders" &&
                          canTransition(
                            u,
                            detail as { status: string; assigneeIds: string[] },
                            "cancelled",
                          ) && (
                            <form onSubmit={(e) => change("cancelled", e)}>
                              <Input name="note" label="เหตุผลยกเลิกใบงาน" />
                              <button className="danger" disabled={busy}>
                                ยกเลิกใบงาน
                              </button>
                            </form>
                          )}
                        <h3>ประวัติ</h3>
                        {detail.history?.map((h: R) => (
                          <div className="timeline" key={h._id}>
                            <p>
                              {h.event === "status.changed"
                                ? `${labels[h.detail.from]} → ${labels[h.detail.to]}`
                                : h.event === "request.created"
                                  ? "บันทึกใบแจ้งซ่อม"
                                : h.event}
                            </p>
                            <small>
                              {date(h.at)} • {displayDocumentNumber(h.reference || detail.number)}
                            </small>
                            {h.detail.note && <p>{h.detail.note}</p>}
                          </div>
                        ))}
                      </section>
                    </div>
                    {view === "workOrders" && (
                      <section className="panel">
                        <h2>บันทึกการทำงาน</h2>
                        {detail.logs?.map((l: R) => (
                          <div className="timeline" key={l._id}>
                            <b>{l.remedy}</b>
                            <p>
                              สาเหตุ: {l.cause} • ผลทดสอบ: {l.testResult}
                            </p>
                            <small>
                              {date(l.start)} – {date(l.end)} •{" "}
                              {l.minutes.toFixed(0)} นาที •{" "}
                              {(l.costSatang / 100).toLocaleString("th-TH")} บาท
                            </small>
                          </div>
                        ))}
                        {u.role === "technician" &&
                          detail.assigneeIds.includes(u._id) &&
                          [
                            "in_progress",
                            "waiting_parts",
                            "waiting_contractor",
                          ].includes(detail.status) && (
                            <form
                              className="form-grid"
                              onSubmit={(e) => {
                                const v = values(e),
                                  f = e.currentTarget;
                                run(async () => {
                                  await api(view + "/" + selected + "/logs", {
                                    ...v,
                                    start: new Date(
                                      String(v.start) + "+07:00",
                                    ).toISOString(),
                                    end: new Date(
                                      String(v.end) + "+07:00",
                                    ).toISOString(),
                                    costSatang: Math.round(
                                      Number(v.cost) * 100,
                                    ),
                                    idempotencyKey: logKey,
                                  });
                                  setLogKey(createUUID());
                                  f.reset();
                                  await load();
                                });
                              }}
                            >
                              <Input name="cause" label="สาเหตุ" />
                              <Input name="remedy" label="วิธีแก้ไข" />
                              <Input
                                name="testResult"
                                label="ผลทดสอบหลังซ่อม"
                              />
                              <Input
                                name="cost"
                                label="ค่าใช้จ่าย (บาท)"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue="0"
                              />
                              <Input name="start" label="เริ่มทำงาน" type="datetime-local" />
                              <Input name="end" label="สิ้นสุด" type="datetime-local" />
                              <button disabled={busy}>บันทึกผลซ่อม</button>
                            </form>
                          )}
                      </section>
                    )}
                  </>
                )}
              {view === "assets" && selected && detail && (
                <section className="panel">
                  <button className="ghost" onClick={() => setSelected(null)}>
                    ← กลับทะเบียน
                  </button>
                  <h2>
                    {detail.code} • {detail.name}
                  </h2>
                  <p>
                    {detail.brand} {detail.model} • Serial{" "}
                    {detail.serialNumber || "—"}
                  </p>
                  {qr && (
                    <img
                      className="qr"
                      src={qr}
                      alt={"QR เปิดเครื่องจักร " + detail.name}
                    />
                  )}
                  <p className="muted">
                    สแกนด้วยกล้องมือถือเพื่อเปิดข้อมูลหลังเข้าสู่ระบบ
                  </p>
                  <div className="asset-actions">
                  {u.role !== "executive" && (
                    <button
                      onClick={() => {
                        setSite(detail.siteId);
                        setLocation(detail.locationId);
                        setAsset(detail._id);
                        nav("new");
                      }}
                    >
                      แจ้งซ่อมเครื่องนี้
                    </button>
                  )}
                  {manager(u) && inScope(u, { companyId: detail.companyId, siteId: detail.siteId }) && (
                    <AssetEditor
                      key={detail._id}
                      asset={detail}
                      canEdit={permitted(u, "assets", "edit")}
                      canDelete={permitted(u, "assets", "delete")}
                      companyName={(() => {
                        const company = (look.companies || []).find((item: R) => item._id === detail.companyId);
                        return company?.nameTh || company?.name || company?.code || detail.companyId;
                      })()}
                      companies={look.companies || []}
                      sites={look.sites}
                      locations={look.locations}
                      busy={busy}
                      onSave={async (values) => {
                        await run(async () => {
                          await api(`assets/${detail._id}`, values);
                          setLook(await api("lookups"));
                          setDetail(await api(`assets/${detail._id}`));
                          setSuccess("แก้ไขข้อมูลเครื่องจักรสำเร็จ");
                        });
                      }}
                      onDelete={async () => {
                        await run(async () => {
                          await api(`assets/${detail._id}/delete`, {});
                          setLook(await api("lookups"));
                          setSelected(null);
                          setDetail(null);
                          await load();
                          setSuccess("ลบเครื่องจักรสำเร็จ");
                        });
                      }}
                    />
                  )}
                  </div>
                  <h3>ประวัติใบงาน</h3>
                  {detail.orders.map((o: R) => (
                    <button
                      key={o._id}
                      className="secondary"
                      onClick={() => {
                        setView("workOrders");
                        setSelected(o._id);
                        setDetail(null);
                      }}
                    >
                      {displayDocumentNumber(o.number)} • {o.title}
                    </button>
                  ))}
                  {!detail.orders.length && (
                    <p className="muted">
                      ยังไม่มีประวัติใบงานที่คุณมีสิทธิ์ดู
                    </p>
                  )}
                  <h3>PM / มิเตอร์ / Downtime</h3>
                  <p className="muted">ยังไม่รองรับในระยะที่ 1</p>
                </section>
              )}
              {view === "notifications" && <Notifications key={`center-${u._id}`} userId={u._id} full onOpen={openNotification} />}
              {!selected &&
                [
                  "repairRequests",
                  "workOrders",
                  "assets",
                ].includes(view) && (
                  <section className="panel">
                    <div className="list-toolbar">
                      <h2>{titles[view]}</h2>
                      {["repairRequests", "workOrders"].includes(view) && (
                        <form
                          className="filter"
                          onSubmit={(e) => {
                            e.preventDefault();
                            setPage(1);
                            load();
                          }}
                        >
                          <input
                            aria-label="ค้นหาหัวข้อ"
                            placeholder="ค้นหาหัวข้อ…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                          />
                          <select
                            aria-label="กรองสถานะ"
                            value={status}
                            onChange={(e) => {
                              setStatus(e.target.value);
                              setPage(1);
                            }}
                          >
                            <option value="">ทุกสถานะ</option>
                            {view === "workOrders" && <option value="outstanding">{"\u0e43\u0e1a\u0e07\u0e32\u0e19\u0e04\u0e07\u0e04\u0e49\u0e32\u0e07"}</option>}
                            {view === "workOrders" && <option value="overdue">{"\u0e43\u0e1a\u0e07\u0e32\u0e19\u0e40\u0e01\u0e34\u0e19\u0e01\u0e33\u0e2b\u0e19\u0e14"}</option>}
                            {view === "workOrders" && <option value="waiting">{"\u0e23\u0e2d\u0e2d\u0e30\u0e44\u0e2b\u0e25\u0e48 / \u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e40\u0e2b\u0e21\u0e32"}</option>}
                            {Object.entries(labels).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                          <button className="secondary">ค้นหา</button>
                        </form>
                      )}
                    </div>
                    {!rows.length ? (
                      <div className="empty">
                        ยังไม่มีรายการในขอบเขตสิทธิ์นี้
                      </div>
                    ) : (
                      <div className="table-scroll">
                        <table className="data-table">
                          <caption className="sr-only">{titles[view]}</caption>
                          <thead>
                            <tr>
                              <th scope="col">
                                {["repairRequests", "workOrders"].includes(view)
                                  ? "เลขที่เอกสาร"
                                  : view === "assets"
                                    ? "รหัสเครื่องจักร"
                                    : "รายการ"}
                              </th>
                              <th scope="col">รายละเอียด</th>
                              <th scope="col">สถานะ / บทบาท</th>
                              <th scope="col">วันเวลา / ข้อมูลเพิ่มเติม</th>
                              <th scope="col">
                                <span className="sr-only">ดำเนินการ</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(view === "assets" ? assetPages.items : rows).map((r) => {
                              const clickable = [
                                "repairRequests",
                                "workOrders",
                                "assets",
                              ].includes(view);
                              const openDetail = () => {
                                setSelected(r._id);
                                setDetail(null);
                              };
                              return (
                                <tr key={r._id}>
                                  <td data-label="รหัส / รายการ">
                                    {clickable ? (
                                      <button
                                        className="table-link"
                                        onClick={openDetail}
                                      >
                                        {(r.number && displayDocumentNumber(r.number)) || r.code || r._id}
                                      </button>
                                    ) : (
                                      <strong>
                                        {r.name || r.message || r.event || "—"}
                                      </strong>
                                    )}
                                  </td>
                                  <td data-label="รายละเอียด">
                                    <b>
                                      {r.title ||
                                        (clickable
                                          ? r.name
                                          : r.username || r.siteId) ||
                                        "—"}
                                    </b>
                                    {clickable && (
                                      <small>
                                        {look.sites.find(
                                          (site: R) => site._id === r.siteId,
                                        )?.name ||
                                          r.siteId ||
                                          ""}
                                      </small>
                                    )}
                                  </td>
                                  <td data-label="สถานะ / บทบาท">
                                    {r.status ? (
                                      <Badge status={r.status} />
                                    ) : (
                                      r.role || "—"
                                    )}
                                  </td>
                                  <td data-label="วันเวลา / ข้อมูลเพิ่มเติม">
                                    {r.createdAt
                                      ? date(r.createdAt)
                                      : r.at
                                        ? date(r.at)
                                        : r.model || "—"}
                                  </td>
                                  <td>
                                    {clickable && (
                                      <button
                                        className="table-open ghost"
                                        onClick={openDetail}
                                        aria-label={
                                          "เปิดรายละเอียด " +
                                          ((r.number && displayDocumentNumber(r.number)) || r.code || r.name)
                                        }
                                      >
                                        ดูรายละเอียด →
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {["repairRequests", "workOrders"].includes(view) && (
                      <Pagination page={page} total={total} count={rows.length} loading={loading} onChange={setPage} />
                    )}
                    {view === "assets" && <Pagination page={assetPages.page} total={rows.length} count={assetPages.items.length} loading={loading} onChange={assetPages.setPage} />}
                  </section>
                )}
              {!selected &&
                manager(u) && permitted(u, "assets", "create") &&
                ["assets"].includes(view) && (
                  <form
                    className="panel form-grid"
                    onSubmit={(e) => {
                      const v = values(e),
                        f = e.currentTarget,
                        s = look.sites.find((x: R) => x._id === assetSite && x.companyId === assetCompany);
                      run(async () => {
                        if (!s) throw new Error("กรุณาเลือกบริษัทและสาขา");
                        await api(view, {
                          ...v,
                          companyId: s.companyId,
                          siteId: assetSite,
                        });
                        f.reset();
                        setLook(await api("lookups"));
                        setSuccess("เพิ่มข้อมูลสำเร็จ");
                        await load();
                      });
                    }}
                  >
                    <h2 className="wide">เพิ่ม{titles[view]}</h2>
                    <label>
                      บริษัท
                      <select required value={assetCompany} onChange={(e) => {
                        setAssetCompany(e.target.value);
                        setAssetSite("");
                        setAssetLocation("");
                      }}>
                        <option value="" disabled>เลือกบริษัท</option>
                        {(look.companies || []).filter((company: R) => look.sites.some((s: R) => s.companyId === company._id)).map((company: R) => (
                          <option key={company._id} value={company._id}>{company.nameTh || company.name || company.code}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      สาขา
                      <select
                        required
                        value={assetSite}
                        disabled={!assetCompany}
                        onChange={(e) => { setAssetSite(e.target.value); setAssetLocation(""); }}
                      >
                        <option value="" disabled>เลือกสาขา</option>
                        {look.sites.filter((s: R) => s.companyId === assetCompany).map((s: R) => (
                          <option key={s._id} value={s._id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input name="name" label="ชื่อ" />
                    {view === "assets" && (
                      <>
                        <Input name="code" label="รหัสทรัพย์สิน" />
                        <label>
                          สถานที่
                          <select name="locationId" required value={assetLocation} disabled={!assetSite} onChange={(e) => setAssetLocation(e.target.value)}>
                            <option value="" disabled>เลือกสถานที่</option>
                            {look.locations
                              .filter((x: R) => x.siteId === assetSite && x.companyId === assetCompany)
                              .map((x: R) => (
                                <option key={x._id} value={x._id}>
                                  {x.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <Input name="brand" label="ยี่ห้อ" required={false} />
                        <Input name="model" label="รุ่น" required={false} />
                        <Input
                          name="serialNumber"
                          label="Serial Number"
                          required={false}
                        />
                      </>
                    )}
                    <button disabled={busy}>เพิ่มข้อมูล</button>
                  </form>
                )}
              {view === "auditLogs" && u.role === "admin" && (
                <AuditHistory
                  key={`${auditActor}:${auditModuleFilter}`}
                  initialActor={auditActor}
                  initialModule={auditModuleFilter}
                  onOpen={(nextView, id) => {
                    nav(nextView);
                    setSelected(id);
                    setDetail(null);
                  }}
                />
              )}
              {(view === "guide" || view === "flow") && (
                <Guide
                  key={view}
                  mode={view === "flow" ? "flow" : "guide"}
                  user={u}
                  onNavigate={(nextView, filter) => {
                    nav(nextView);
                    if (filter) {
                      setStatus(filter);
                      const url = new URL(window.location.href);
                      url.searchParams.set("status", filter);
                      window.history.replaceState(
                        null,
                        "",
                        url.pathname + url.search + url.hash,
                      );
                    }
                  }}
                />
              )}
              {["sites","locations"].includes(view) && u.role === "admin" && (
                <MasterData key={view} kind={view as "sites" | "locations"} onSaved={()=>{Promise.all([api("me"),api("lookups")]).then(([current,lookups])=>{setU(current);setLook(lookups);setSite(previous=>lookups.sites.some((x:R)=>x._id===previous)?previous:lookups.sites[0]?._id || "");}).catch(e=>setError(e.message));}} />
              )}
              {view === "companies" && u.role === "admin" && (
                <Companies onSaved={()=>{Promise.all([api("me"),api("lookups")]).then(([current,lookups])=>{setU(current);setLook(lookups);setSite(previous=>lookups.sites.some((x:R)=>x._id===previous)?previous:lookups.sites[0]?._id || "");}).catch(e=>setError(e.message));}} />
              )}
              {view === "workTypes" && u.role === "admin" && (
                <WorkTypes onSaved={()=>{api("lookups").then(setLook).catch(e=>setError(e.message));}} />
              )}
              {view === "settings" && u.role === "admin" && (
                <SystemSettings
                  onSaved={() => {
                    api("lookups")
                      .then(setLook)
                      .catch((e) => setError(e.message));
                  }}
                />
              )}
              {view === "smtp" && u.role === "admin" && <SmtpSettings />}
              {view === "users" && u.role === "admin" && (
                <AdminUsers
                  currentUser={u}
                  sites={look.sites}
                  onSaved={(requiresLogin) => {
                    if (requiresLogin) {
                      setU(null);
                      setSuccess("");
                    } else {
                      api("me")
                        .then(setU)
                        .catch(() => setU(null));
                    }
                  }}
                />
              )}
              {view === "profile" && (
                <form
                  className="panel form-grid"
                  onSubmit={(e) => {
                    const v = values(e);
                    run(async () => {
                      await api("profile", {
                        ...v,
                        newPassword: v.newPassword || undefined,
                      });
                      if (v.newPassword) {
                        setU(null);
                      } else {
                        setU(await api("me"));
                        setSuccess("แก้ไขโปรไฟล์สำเร็จ");
                      }
                    });
                  }}
                >
                  <Input
                    name="name"
                    label="ชื่อ-นามสกุล"
                    defaultValue={u.name}
                  />
                  <Input
                    name="currentPassword"
                    label="รหัสผ่านปัจจุบัน"
                    type="password"
                  />
                  <Input
                    name="newPassword"
                    label="รหัสผ่านใหม่"
                    type="password"
                    required={false}
                  />
                  <button disabled={busy}>บันทึกโปรไฟล์</button>
                  <p className="wide muted">
                    เปลี่ยนรหัสผ่านแล้วระบบจะออกจากทุกอุปกรณ์
                  </p>
                </form>
              )}
            </>
          )}
          <footer>AGE CMMS · ศูนย์งานซ่อมบำรุง · เวลา Asia/Bangkok</footer>
        </main>
      </div>
    </div>
  );
}
function locationOrigin() {
  return window.location.origin;
}
