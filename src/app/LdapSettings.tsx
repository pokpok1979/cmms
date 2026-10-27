"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { LdapConfig } from "@/lib/ldap-policy";
import "./ldap-settings.css";
type Row = Record<string, any>;
const defaults: LdapConfig = {
  companyId: "",
  revision: 0,
  enabled: false,
  verifyTlsCertificate: true,
  ldapTransport: "starttls",
  mode: "sync",
  directory: "ad",
  url: "",
  baseDn: "",
  bindDn: "",
  bindPassword: "",
  caCertificate: "",
  filter:
    "(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))",
  usernameAttribute: "sAMAccountName",
  nameAttribute: "displayName",
  emailAttribute: "mail",
  siteId: "",
  departmentAttribute: "department",
  positionAttribute: "title",
};
function date(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
export default function LdapSettings() {
  const [data, setData] = useState<{
      companies: Row[];
      sites: Row[];
      configs: Row[];
      encryptionReady: boolean;
    } | null>(null),
    [form, setForm] = useState<LdapConfig>({ ...defaults });
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [dirty, setDirty] = useState(false);
  function select(companyId: string, result = data) {
    const config = result?.configs.find((x) => x.companyId === companyId);
    const next = { ...defaults, companyId };
    for (const key of Object.keys(defaults) as (keyof LdapConfig)[])
      if (config && key !== "bindPassword" && config[key] !== undefined)
        (next as Row)[key] = config[key];
    setForm({ ...next, mode: "sync" });
    setDirty(false);
  }
  async function load(companyId?: string) {
    const response = await fetch("/api/ldap-settings", { cache: "no-store" }),
      result = await response.json();
    if (!response.ok) throw Error(result.error);
    setData(result);
    select(companyId || result.companies[0]?._id || "", result);
  }
  useEffect(() => {
    let active = true;
    load()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  function change<K extends keyof LdapConfig>(key: K, value: LdapConfig[K]) {
    setForm((old) => ({ ...old, [key]: value }));
    setDirty(true);
    setSuccess("");
  }
  async function action(action: "save" | "test" | "sync") {
    if (busy || loading || !form.companyId) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/ldap-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "save"
            ? { action, ...form }
            : { action, companyId: form.companyId },
        ),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setSuccess(
        action === "save"
          ? "บันทึกการตั้งค่า AD สำเร็จ"
          : action === "test"
            ? `เชื่อมต่อสำเร็จ พบ ${result.count} บัญชี`
            : `ซิงก์สำเร็จ: เพิ่ม ${result.created} · อัปเดต ${result.updated} · ข้าม ${result.skipped} บัญชี`,
      );
      if (action !== "test") await load(form.companyId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function field(
    key: keyof LdapConfig,
    label: string,
    placeholder = "",
    type = "text",
    required = true,
  ) {
    return (
      <label>
        {label}
        <input
          type={type}
          value={String(form[key] || "")}
          required={required}
          placeholder={placeholder}
          autoComplete={type === "password" ? "new-password" : "off"}
          maxLength={key === "bindPassword" ? 2000 : 1000}
          onChange={(e) => change(key, e.target.value as never)}
        />
      </label>
    );
  }
  const saved = data?.configs.find((x) => x.companyId === form.companyId),
    disabled = loading || busy;
  return (
    <div className="ldap-settings" aria-busy={disabled}>
      <div className="page-heading">
        <div>
          <h1>
            <span className="heading-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <rect x="8" y="2" width="8" height="6" rx="1" />
                <path d="M12 8v5 M4 16v-3h16v3" />
                <rect x="1" y="16" width="6" height="6" rx="1" />
                <rect x="17" y="16" width="6" height="6" rx="1" />
              </svg>
            </span>
            ตั้งค่า LDAP / Active Directory
          </h1>
          <p className="muted">
            ซิงก์ข้อมูลผู้ใช้งานแยกตามบริษัท และเข้าสู่ระบบด้วยรหัสผ่าน CMMS
            ที่กำหนดเอง
          </p>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="success" role="status">
          {success}
        </p>
      )}
      <section className="panel">
        <h2>ตารางตั้งค่า LDAP แยกบริษัท</h2>
        {loading ? (
          <p role="status">กำลังโหลด…</p>
        ) : !data?.companies.length ? (
          <p className="muted">ไม่มีบริษัทที่คุณมีสิทธิ์ครบทุกสาขา</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>บริษัท</th>
                  <th>LDAP Server</th>
                  <th>สถานะ</th>
                  <th>ซิงก์ล่าสุด</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {data.companies.map((company) => {
                  const config = data.configs.find(
                    (x) => x.companyId === company._id,
                  );
                  return (
                    <tr key={company._id}>
                      <td data-label="บริษัท">
                        {company.nameTh || company.name || company.code}
                      </td>
                      <td data-label="LDAP Server">
                        {config?.url || "ยังไม่ตั้งค่า"}
                      </td>
                      <td data-label="สถานะ">
                        {config?.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                      </td>
                      <td data-label="ซิงก์ล่าสุด">
                        {config?.lastSyncAt ? date(config.lastSyncAt) : "—"}
                      </td>
                      <td>
                        <button
                          className="ghost"
                          disabled={disabled}
                          onClick={() => {
                            if (
                              dirty &&
                              !window.confirm(
                                "มีข้อมูลที่ยังไม่บันทึก ต้องการเปลี่ยนบริษัทหรือไม่?",
                              )
                            )
                              return;
                            select(company._id);
                            setError("");
                            setSuccess("");
                          }}
                        >
                          {form.companyId === company._id
                            ? "กำลังเลือก"
                            : "ตั้งค่า"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {form.companyId && (
        <form
          className="panel"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void action("save");
          }}
        >
          <h2>
            ตั้งค่าการเชื่อมต่อ ·{" "}
            {data?.companies.find((c) => c._id === form.companyId)?.nameTh ||
              data?.companies.find((c) => c._id === form.companyId)?.name ||
              form.companyId}
          </h2>
          {data && !data.encryptionReady && (
            <p className="ldap-note">
              ยังไม่ได้ตั้งค่ากุญแจเข้ารหัสบนเซิร์ฟเวอร์ กรุณาตั้งค่า
              LDAP_ENCRYPTION_KEY ก่อนบันทึกบัญชีเชื่อมต่อ
            </p>
          )}
          <fieldset disabled={disabled} className="form-grid ldap-fields">
            <legend className="sr-only">การตั้งค่า LDAP</legend>
            <label>
              ประเภท Directory
              <select
                value={form.directory}
                onChange={(e) => {
                  const directory = e.target.value as "ad" | "openldap";
                  setForm((old) => ({
                    ...old,
                    directory,
                    usernameAttribute:
                      directory === "ad" ? "sAMAccountName" : "uid",
                    filter:
                      directory === "ad"
                        ? defaults.filter
                        : "(objectClass=inetOrgPerson)",
                  }));
                  setDirty(true);
                }}
              >
                <option value="ad">Microsoft Active Directory</option>
                <option value="openldap">OpenLDAP</option>
              </select>
            </label>
            {field("url", "LDAP Server", "ldaps://dc.company.local:636")}
            {field("baseDn", "Base DN", "DC=company,DC=local")}
            {field(
              "bindDn",
              "Bind DN / Service Account",
              "CN=cmms-reader,OU=Services,DC=company,DC=local",
            )}
            {field(
              "bindPassword",
              "รหัสผ่าน Service Account",
              saved?.hasPassword
                ? "มีรหัสผ่านแล้ว เว้นว่างเพื่อใช้ค่าเดิม"
                : "ระบุรหัสผ่านบัญชีสำหรับอ่านข้อมูล",
              "password",
              !saved?.hasPassword,
            )}
            <label className="wide">
              ตัวกรองผู้ใช้ (LDAP Filter)
              <input
                required
                maxLength={2000}
                value={form.filter}
                onChange={(e) => change("filter", e.target.value)}
              />
            </label>
            {field("usernameAttribute", "ฟิลด์ Username", "sAMAccountName")}
            {field("nameAttribute", "ฟิลด์ชื่อ-นามสกุล", "displayName")}
            {field("departmentAttribute", "LDAP department", "department")}
            {field("positionAttribute", "LDAP title", "title")}
            {field("emailAttribute", "ฟิลด์ E-mail", "mail")}
            <p className="ldap-note wide">
              ซิงก์เฉพาะข้อมูลผู้ใช้ LDAP / AD โดยใช้รหัสผ่าน CMMS ที่ Admin
              กำหนดให้ ผู้ใช้เปลี่ยนรหัสผ่านเองได้ที่โปรไฟล์
            </p>
            <label>
              สาขาเริ่มต้นสำหรับบัญชีใหม่
              <select
                required
                value={form.siteId}
                onChange={(e) => change("siteId", e.target.value)}
              >
                <option value="" disabled>
                  เลือกสาขา
                </option>
                {data?.sites
                  .filter((s) => s.companyId === form.companyId)
                  .map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="wide">
              วิธีเชื่อมต่อสำหรับ URL ldap:// (ปกติพอร์ต 389)
              <select
                value={form.ldapTransport}
                disabled={form.url.startsWith("ldaps:")}
                onChange={(e) =>
                  change(
                    "ldapTransport",
                    e.target.value as "starttls" | "plain",
                  )
                }
              >
                <option value="starttls">LDAP + StartTLS (เข้ารหัส)</option>
                <option value="plain">LDAP ไม่ใช้ TLS (ไม่เข้ารหัส)</option>
              </select>
              <small>
                URL ldaps:// จะใช้ TLS เสมอ โดยไม่ขึ้นกับตัวเลือกนี้
              </small>
            </label>
            {form.url.startsWith("ldap:") && form.ldapTransport === "plain" && (
              <p className="ldap-note wide">
                การเชื่อมต่อนี้ไม่เข้ารหัส
                ชื่อบัญชีและรหัสผ่านจะส่งผ่านเครือข่ายโดยไม่มี TLS
              </p>
            )}
            <label className="checkbox wide">
              <input
                type="checkbox"
                disabled={
                  form.url.startsWith("ldap:") && form.ldapTransport === "plain"
                }
                checked={form.verifyTlsCertificate}
                onChange={(e) =>
                  change("verifyTlsCertificate", e.target.checked)
                }
              />
              ตรวจสอบใบรับรอง TLS ของ LDAP Server
            </label>
            {!form.verifyTlsCertificate &&
              !(
                form.url.startsWith("ldap:") && form.ldapTransport === "plain"
              ) && (
                <p className="ldap-note wide">
                  โหมดทดลอง: การเชื่อมต่อยังเข้ารหัส
                  แต่ไม่ตรวจสอบตัวตนเซิร์ฟเวอร์จากใบรับรอง
                </p>
              )}
            <label className="wide">
              CA Certificate (PEM) กรณีใช้ CA ภายใน
              <textarea
                rows={3}
                maxLength={30000}
                value={form.caCertificate}
                placeholder="-----BEGIN CERTIFICATE-----"
                onChange={(e) => change("caCertificate", e.target.value)}
              />
            </label>
            <label className="checkbox wide">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => change("enabled", e.target.checked)}
              />
              เปิดใช้งาน LDAP สำหรับบริษัทนี้
            </label>
            <p className="ldap-note wide">
              บัญชีใหม่ยังไม่มีรหัสผ่าน Admin ต้องตั้งรหัสผ่านและเปิดใช้งานก่อน
              การซิงก์ครั้งถัดไปจะคงรหัสผ่าน CMMS เดิม
            </p>
            <div className="ldap-buttons wide">
              <button disabled={!data?.encryptionReady}>
                บันทึกการตั้งค่า
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!saved || dirty}
                onClick={() => void action("test")}
              >
                ทดสอบการเชื่อมต่อ
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!saved?.enabled || dirty}
                onClick={() => void action("sync")}
              >
                ซิงก์รายชื่อจาก AD
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}
