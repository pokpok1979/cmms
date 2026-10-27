"use client";
import Pagination from "./Pagination";
import { useEffect, useState } from "react";
import { AUDIT_PAGE_SIZE, auditPageNumbers } from "@/lib/audit-pagination";
import AuditOverview from "./AuditOverview";
import type { AuditOverviewData } from "@/lib/audit-overview";
import { auditModules } from "@/lib/audit-display";
import "./audit-history.css";
type Entry = {
  _id: string;
  actorId: string;
  actorName: string;
  at: string;
  module: string;
  action: string;
  description: string;
  reference: string;
  entityId: string;
  referenceView: string | null;
  ip?: string;
};
type Result = {
  overview: AuditOverviewData;
  page: number;
  items: Entry[];
  total: number;
  users: { _id: string; name: string }[];
  modules: { _id: string }[];
  actions: { _id: string }[];
};
const emptyFilters = {
  q: "",
  module: "",
  action: "",
  actor: "",
  from: "",
  to: "",
};
function relativeTime(at: string, now: number) {
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(at).getTime()) / 1000),
  );
  if (seconds < 60) return "เมื่อสักครู่";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(seconds / 86400).toLocaleString("th-TH")} วันที่แล้ว`;
}
export default function AuditHistory({
  initialActor = "",
  initialModule = "",
  onOpen,
}: {
  initialActor?: string;
  initialModule?: string;
  onOpen: (view: string, id: string) => void;
}) {
  const [draft, setDraft] = useState({
      ...emptyFilters,
      actor: initialActor,
      module: initialModule,
    }),
    [filters, setFilters] = useState({
      ...emptyFilters,
      actor: initialActor,
      module: initialModule,
    }),
    [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      "/api/audit-history?" +
        new URLSearchParams({ ...filters, page: String(page) }),
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error);
        if (!controller.signal.aborted) {
          const lastPage = Math.max(
            1,
            Math.ceil(result.total / AUDIT_PAGE_SIZE),
          );
          if (page > lastPage) {
            setPage(lastPage);
            return;
          }
          setData(result);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, page]);
  function change(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  const pageCount = Math.max(
    1,
    Math.ceil((data?.total || 0) / AUDIT_PAGE_SIZE),
  );
  const displayedPage = data?.page || page;
  const rangeStart = data?.items.length
    ? (displayedPage - 1) * AUDIT_PAGE_SIZE + 1
    : 0;
  const rangeEnd = data?.items.length ? rangeStart + data.items.length - 1 : 0;
  return (
    <>
      <AuditOverview
        data={error ? undefined : data?.overview}
        loading={loading}
      />
      <section
        className="panel audit-history"
        aria-label="ประวัติการเปลี่ยนแปลง"
      >
        <form
          className="audit-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setFilters({ ...draft });
          }}
        >
          <div className="audit-filter-top">
            <label className="audit-search">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="ค้นหาประวัติ"
                placeholder="เลขที่เอกสาร, รายละเอียด, IP…"
                value={draft.q}
                onChange={(e) => change("q", e.target.value)}
              />
            </label>
            <select
              aria-label="โมดูล"
              value={draft.module}
              onChange={(e) => change("module", e.target.value)}
            >
              <option value="">ทุกโมดูล</option>
              {draft.module &&
                !data?.modules.some((x) => x._id === draft.module) && (
                  <option value={draft.module}>
                    {auditModules[draft.module] || draft.module}
                  </option>
                )}
              {data?.modules.map((x) => (
                <option key={x._id} value={x._id}>
                  {auditModules[x._id] || "อื่น ๆ"}
                </option>
              ))}
            </select>
            <select
              aria-label="การกระทำ"
              value={draft.action}
              onChange={(e) => change("action", e.target.value)}
            >
              <option value="">ทุกการกระทำ</option>
              {data?.actions.map((x) => (
                <option key={x._id} value={x._id}>
                  {x._id}
                </option>
              ))}
            </select>
          </div>
          <select
            className="audit-user-filter"
            aria-label="ผู้ใช้"
            value={draft.actor}
            onChange={(e) => change("actor", e.target.value)}
          >
            <option value="">ผู้ใช้ทั้งหมด</option>
            {draft.actor && !data?.users.some((x) => x._id === draft.actor) && (
              <option value={draft.actor}>ผู้ใช้ที่เลือก</option>
            )}
            {data?.users.map((x) => (
              <option key={x._id} value={x._id}>
                {x.name}
              </option>
            ))}
          </select>
          <div className="audit-filter-bottom">
            <div className="audit-dates">
              <label>
                <span>วันที่</span>
                <input
                  type="date"
                  aria-label="วันที่เริ่มต้น"
                  value={draft.from}
                  max={draft.to || undefined}
                  onChange={(e) => change("from", e.target.value)}
                />
              </label>
              <label>
                <span>ถึง</span>
                <input
                  type="date"
                  aria-label="วันที่สิ้นสุด"
                  value={draft.to}
                  min={draft.from || undefined}
                  onChange={(e) => change("to", e.target.value)}
                />
              </label>
            </div>
            <button className="secondary" disabled={loading}>
              ▽ กรอง
            </button>
            <span className="audit-count" role="status">
              {loading
                ? "กำลังโหลด…"
                : `${(data?.total || 0).toLocaleString("th-TH")} รายการ`}
            </span>
          </div>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="table-scroll" aria-busy={loading}>
          <table className="data-table audit-table">
            <caption className="sr-only">ประวัติการเปลี่ยนแปลง</caption>
            <thead>
              <tr>
                {[
                  "เวลา",
                  "ผู้ใช้",
                  "โมดูล",
                  "การกระทำ",
                  "รายละเอียด",
                  "เอกสารอ้างอิง",
                  "IP",
                ].map((title) => (
                  <th scope="col" key={title}>
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!error &&
                data?.items.map((row) => (
                  <tr key={row._id}>
                    <td data-label="เวลา">
                      <time dateTime={row.at}>
                        {new Date(row.at).toLocaleString("th-TH", {
                          timeZone: "Asia/Bangkok",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      <small>{relativeTime(row.at, now)}</small>
                    </td>
                    <td data-label="ผู้ใช้">
                      <span className="audit-person">
                        <span className="audit-avatar" aria-hidden="true">
                          {Array.from(row.actorName || "?")
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span>{row.actorName || row.actorId}</span>
                      </span>
                    </td>
                    <td data-label="โมดูล">
                      <span className="audit-module">
                        {auditModules[row.module] || "อื่น ๆ"}
                      </span>
                    </td>
                    <td data-label="การกระทำ">
                      <span className="audit-action">{row.action}</span>
                    </td>
                    <td data-label="รายละเอียด">{row.description}</td>
                    <td data-label="เอกสารอ้างอิง">
                      {row.referenceView && row.entityId ? (
                        <button
                          type="button"
                          className="table-link audit-reference"
                          onClick={() =>
                            onOpen(row.referenceView!, row.entityId)
                          }
                        >
                          {row.reference || "—"}
                        </button>
                      ) : (
                        <span className="audit-reference">
                          {row.reference || "—"}
                        </span>
                      )}
                    </td>
                    <td data-label="IP" className="audit-ip">
                      {row.ip || "—"}
                    </td>
                  </tr>
                ))}
              {!loading && !error && !data?.items.length && (
                <tr>
                  <td colSpan={7} className="empty">
                    ไม่พบประวัติที่ตรงกับตัวกรอง
                  </td>
                </tr>
              )}
              {loading && !data && (
                <tr>
                  <td colSpan={7} className="empty">
                    กำลังโหลดประวัติ…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={displayedPage} total={data?.total || 0} pageSize={AUDIT_PAGE_SIZE} count={data?.items.length || 0} loading={loading} onChange={setPage} />
      </section>
    </>
  );
}
