"use client";
import { displayDocumentNumber } from "@/lib/document-number";
import { useEffect, useState } from "react";
import { labels, User } from "@/lib/domain";
import "./dashboard.css";
type Overview = {
  requests: number;
  pending: number;
  active: number;
  overdue: number;
  completed: number;
  waiting: number;
  review: number;
  costSatang: number;
  statuses: { _id: string; count: number }[];
  created: { _id: string; count: number }[];
  finished: { _id: string; count: number }[];
  orders: {
    _id: string;
    number: string;
    title: string;
    status: string;
    dueAt: string;
    siteId: string;
  }[];
  recent: {
    _id: string;
    number: string;
    title: string;
    status: string;
    createdAt: string;
  }[];
  refreshedAt: string;
};
const roleNames: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  supervisor: "หัวหน้างาน",
  technician: "ช่าง",
  requester: "ผู้แจ้งซ่อม",
  executive: "ผู้บริหาร",
};
const colors = [
  "#10b981",
  "#60a5fa",
  "#fbbf24",
  "#a78bfa",
  "#fb7185",
  "#2dd4bf",
  "#94a3b8",
  "#f97316",
  "#818cf8",
];
function AnimatedValue({ value }: { value: number }) {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const p = Math.min((t - start) / 650, 1);
      setN(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{n.toLocaleString("th-TH")}</>;
}
export default function Dashboard({
  user,
  onNavigate,
  onOpen,
}: {
  user: User;
  onNavigate: (view: string, status?: string) => void;
  onOpen: (view: string, id: string) => void;
}) {
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [mode, setMode] = useState("chart");
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const [selectedBar, setSelectedBar] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  async function reload() {
    setSelectedBar(null);
    setSelectedStatus(null);
    setHoveredStatus(null);
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard-overview", { cache: "no-store" });
      const x = await res.json();
      if (!res.ok) throw Error(x.error);
      setData(x);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, [user._id]);
  const now = data ? new Date(data.refreshedAt) : null;
  const hour = now
    ? Number(
        new Intl.DateTimeFormat("en", {
          timeZone: "Asia/Bangkok",
          hour: "numeric",
          hourCycle: "h23",
        }).format(now),
      )
    : 12;
  const greeting =
    hour < 12 ? "สวัสดีตอนเช้า" : hour < 18 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น";
  if (!data)
    return (
      <section className="panel">
        <p role={error ? "alert" : "status"}>{error || "กำลังโหลดภาพรวม…"}</p>
        {error && <button onClick={reload}>ลองใหม่</button>}
      </section>
    );
  const metrics: [string, number, string, string, string?][] = [
    ["ใบแจ้งซ่อมทั้งหมด", data.requests, "repairRequests", "emerald"],
    ["รออนุมัติ", data.pending, "repairRequests", "amber", "pending"],
    ["ใบงานคงค้าง", data.active, "workOrders", "blue", "outstanding"],
    ["ใบงานเกินกำหนด", data.overdue, "workOrders", "rose", "overdue"],
    ["ใบงานเสร็จสิ้น", data.completed, "workOrders", "emerald", "completed"],
    ["รออะไหล่ / ผู้รับเหมา", data.waiting, "workOrders", "amber", "waiting"],
    ["รอตรวจรับ", data.review, "workOrders", "violet", "review"],
    ["ค่าใช้จ่ายสะสม (บาท)", data.costSatang / 100, "workOrders", "blue"],
  ];
  const monthParts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now!);
  const year = Number(monthParts.find((x) => x.type === "year")!.value),
    month = Number(monthParts.find((x) => x.type === "month")!.value) - 1;
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 5 + i, 1));
    const id = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      id,
      label: date.toLocaleDateString("th-TH", {
        timeZone: "UTC",
        month: "short",
      }),
      created: data.created.find((x) => x._id === id)?.count || 0,
      finished: data.finished.find((x) => x._id === id)?.count || 0,
    };
  });
  const max = Math.max(1, ...months.flatMap((x) => [x.created, x.finished]));
  const total = data.statuses.reduce((n, x) => n + x.count, 0);
  let offset = 0;
  const gradient = data.statuses
    .map((x, i) => {
      const start = offset;
      offset += (x.count / Math.max(total, 1)) * 100;
      return `${x._id === selectedStatus ? ["#047857", "#2563eb", "#b45309", "#7c3aed", "#be123c", "#0f766e", "#475569", "#c2410c", "#4338ca"][i % colors.length] : colors[i % colors.length]} ${start}% ${offset}%`;
    })
    .join(",");
  function statusAt(clientX: number, clientY: number, rect: DOMRect) {
    const dx = clientX - rect.left - rect.width / 2,
      dy = clientY - rect.top - rect.height / 2;
    const radius = Math.hypot(dx, dy);
    if (radius < (rect.width * 130) / 340 || radius > rect.width / 2)
      return null;
    const fraction =
      ((Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
    let cumulative = 0;
    const status = data?.statuses.find((x) => {
      cumulative += x.count;
      return fraction < cumulative / total;
    });
    return status ? status._id : null;
  }
  function selectStatus(status: string | null) {
    setSelectedStatus((current) => (current === status ? null : status));
  }
  const date = (v: string) =>
    new Date(v).toLocaleDateString("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  return (
    <div className="cmms-dashboard">
      <section className="dash-welcome">
        <div>
          <p className="dash-date">
            {now!.toLocaleDateString("th-TH", {
              timeZone: "Asia/Bangkok",
              dateStyle: "full",
            })}
          </p>
          <h1>
            {greeting}, {user.name}
          </h1>
          <p>
            ภาพรวมงานซ่อมบำรุงตามขอบเขตสิทธิ์ ·{" "}
            {roleNames[user.role] || user.role}
          </p>
        </div>
        <button className="secondary" disabled={loading} onClick={reload}>
          {loading ? "กำลังโหลด…" : "↻ รีเฟรชข้อมูล"}
        </button>
        <div className="dash-shortcuts">
          {user.role !== "executive" && (
            <button onClick={() => onNavigate("new")}>＋ แจ้งซ่อม</button>
          )}
          <button onClick={() => onNavigate("workOrders")}>✓ ใบงานซ่อม</button>
          <button onClick={() => onNavigate("assets")}>▣ เครื่องจักร</button>
          <button onClick={() => onNavigate("notifications")}>
            ◉ การแจ้งเตือน
          </button>
        </div>
        <div className="dash-live">
          <span>● ข้อมูลล่าสุด</span>
          <span>
            {now!.toLocaleTimeString("th-TH", {
              timeZone: "Asia/Bangkok",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            น.
          </span>
          <span>{data.active} ใบงานคงค้าง</span>
          <span>{data.pending} คำขอรออนุมัติ</span>
          {data.overdue > 0 && (
            <span className="dash-warning">เกินกำหนด {data.overdue} ใบงาน</span>
          )}
        </div>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="dash-metrics">
        {metrics.map(([title, value, view, color, status], i) => (
          <button
            key={title}
            className={`dash-metric ${color}`}
            onClick={() => onNavigate(view, status)}
          >
            <div className="dash-metric-top">
              <span className="dash-metric-icon">
                {["▤", "◷", "✓", "!", "✓", "▣", "◉", "฿"][i]}
              </span>
              <span className="dash-metric-arrow">↗</span>
            </div>
            <span>{title}</span>
            <strong>
              {i === 7 ? (
                value.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              ) : (
                <AnimatedValue value={value} />
              )}
            </strong>
            <small>
              {i === 7
                ? "ยอดบันทึกในใบงานทั้งหมดตามสิทธิ์"
                : "ดูรายการในขอบเขตสิทธิ์ →"}
            </small>
          </button>
        ))}
      </div>
      <div className="dash-chart-grid">
        <section className="panel">
          <div className="dash-panel-title">
            <h2>แนวโน้มงานซ่อม · 6 เดือนล่าสุด</h2>
            <div className="dash-tabs">
              <button
                className={mode === "chart" ? "selected" : ""}
                onClick={() => setMode("chart")}
              >
                กราฟ
              </button>
              <button
                className={mode === "table" ? "selected" : ""}
                onClick={() => setMode("table")}
              >
                ตาราง
              </button>
            </div>
          </div>
          <div className="dash-legend">
            <span>
              <i style={{ background: "#10b981" }} />
              คำขอที่สร้าง
            </span>
            <span>
              <i style={{ background: "#60a5fa" }} />
              ใบงานที่เสร็จ
            </span>
          </div>
          {mode === "table" ? (
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">จำนวนงานรายเดือน</caption>
                <thead>
                  <tr>
                    <th>เดือน</th>
                    <th>คำขอที่สร้าง</th>
                    <th>ใบงานที่เสร็จ</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((x) => (
                    <tr key={x.id}>
                      <td data-label="เดือน">{x.id}</td>
                      <td data-label="คำขอ">{x.created}</td>
                      <td data-label="ใบงานเสร็จ">{x.finished}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className="dash-bars"
              role="group"
              aria-label={months
                .map(
                  (x) => `${x.id}: คำขอ ${x.created}, ใบงานเสร็จ ${x.finished}`,
                )
                .join("; ")}
            >
              {months.map((x) => (
                <div
                  className="dash-bar-group"
                  key={x.id}
                  tabIndex={0}
                  aria-describedby={`trend-${x.id}`}
                >
                  <div
                    className="dash-chart-tooltip dash-trend-tooltip"
                    id={`trend-${x.id}`}
                    role="tooltip"
                  >
                    <strong>
                      {x.label} {Number(x.id.slice(0, 4)) + 543}
                    </strong>
                    <div>
                      <span>
                        <i style={{ background: "#10b981" }} />
                        คำขอที่สร้าง
                      </span>
                      <b>{x.created.toLocaleString("th-TH")}</b>
                    </div>
                    <div>
                      <span>
                        <i style={{ background: "#60a5fa" }} />
                        ใบงานที่เสร็จ
                      </span>
                      <b>{x.finished.toLocaleString("th-TH")}</b>
                    </div>
                  </div>
                  <div className="dash-bar-pair">
                    <div
                      className={
                        selectedBar === `${x.id}-created`
                          ? "dash-bar-selected"
                          : ""
                      }
                      role="button"
                      tabIndex={0}
                      aria-pressed={selectedBar === `${x.id}-created`}
                      aria-label={`${x.id} created ${x.created}`}
                      onClick={() =>
                        setSelectedBar((current) =>
                          current === `${x.id}-created`
                            ? null
                            : `${x.id}-created`,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedBar((current) =>
                            current === `${x.id}-created`
                              ? null
                              : `${x.id}-created`,
                          );
                        }
                      }}
                      style={{
                        height: `${(x.created / max) * 160}px`,
                        background: "#10b981",
                      }}
                    >
                      <span>{x.created}</span>
                    </div>
                    <div
                      className={
                        selectedBar === `${x.id}-finished`
                          ? "dash-bar-selected"
                          : ""
                      }
                      role="button"
                      tabIndex={0}
                      aria-pressed={selectedBar === `${x.id}-finished`}
                      aria-label={`${x.id} finished ${x.finished}`}
                      onClick={() =>
                        setSelectedBar((current) =>
                          current === `${x.id}-finished`
                            ? null
                            : `${x.id}-finished`,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedBar((current) =>
                            current === `${x.id}-finished`
                              ? null
                              : `${x.id}-finished`,
                          );
                        }
                      }}
                      style={{
                        height: `${(x.finished / max) * 160}px`,
                        background: "#60a5fa",
                      }}
                    >
                      <span>{x.finished}</span>
                    </div>
                  </div>
                  <small>{x.label}</small>
                </div>
              ))}
            </div>
          )}
          <p className="dash-caption">
            คำขอนับตามวันที่สร้าง · ใบงานเสร็จนับตาม completedAt
            และสถานะเสร็จสิ้นปัจจุบัน · เวลาไทย
          </p>
        </section>
        <section className="panel">
          <div className="dash-panel-title">
            <h2>สัดส่วนสถานะใบงาน</h2>
          </div>
          {total ? (
            <div className="dash-status-layout">
              <div className="dash-donut-wrap">
                <div
                  className="dash-donut"
                  style={{ background: `conic-gradient(${gradient})` }}
                  role="img"
                  aria-label={data.statuses
                    .map((x) => `${labels[x._id] || x._id} ${x.count}`)
                    .join(", ")}
                  onPointerMove={(event) => {
                    setHoveredStatus(
                      statusAt(
                        event.clientX,
                        event.clientY,
                        event.currentTarget.getBoundingClientRect(),
                      ),
                    );
                  }}
                  onClick={(event) =>
                    selectStatus(
                      statusAt(
                        event.clientX,
                        event.clientY,
                        event.currentTarget.getBoundingClientRect(),
                      ),
                    )
                  }
                  onPointerLeave={() => setHoveredStatus(null)}
                >
                  <div>
                    <strong>{total}</strong>
                    <small>ใบงานทั้งหมด</small>
                  </div>
                </div>
                {data.statuses
                  .filter((x) => x._id === hoveredStatus)
                  .map((x) => (
                    <div
                      className="dash-chart-tooltip dash-status-tooltip"
                      role="tooltip"
                      id={`status-${x._id}`}
                      key={x._id}
                    >
                      <strong>{labels[x._id] || x._id}</strong>
                      <div>
                        <span>จำนวนใบงาน</span>
                        <b>{x.count.toLocaleString("th-TH")}</b>
                      </div>
                      <div>
                        <span>สัดส่วน</span>
                        <b>
                          {((x.count / total) * 100).toLocaleString("th-TH", {
                            maximumFractionDigits: 1,
                          })}
                          %
                        </b>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="dash-status-list">
                {data.statuses.map((x, i) => (
                  <div
                    key={x._id}
                    role="button"
                    aria-pressed={selectedStatus === x._id}
                    onClick={() => selectStatus(x._id)}
                    tabIndex={0}
                    aria-label={`${labels[x._id] || x._id} ${x.count} ใบงาน`}
                    aria-describedby={
                      hoveredStatus === x._id ? `status-${x._id}` : undefined
                    }
                    onPointerEnter={() => setHoveredStatus(x._id)}
                    onPointerLeave={() => setHoveredStatus(null)}
                    onFocus={() => setHoveredStatus(x._id)}
                    onBlur={() => setHoveredStatus(null)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setHoveredStatus(null);
                        setSelectedStatus(null);
                      }
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectStatus(x._id);
                      }
                    }}
                  >
                    <span>
                      <i style={{ background: colors[i % colors.length] }} />
                      {labels[x._id] || x._id}
                    </span>
                    <b>{x.count}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="empty">ยังไม่มีใบงาน</p>
          )}
        </section>
      </div>
      <div className="dash-lists">
        <section className="panel">
          <div className="dash-panel-title">
            <h2>ใบงานคงค้าง · กำหนดเสร็จใกล้ที่สุด</h2>
            <button className="ghost" onClick={() => onNavigate("workOrders", "outstanding")}>
              ทั้งหมด →
            </button>
          </div>
          {data.orders.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>เลขที่ใบงาน</th>
                    <th>หัวข้อ</th>
                    <th>กำหนดเสร็จ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((x) => (
                    <tr key={x._id}>
                      <td data-label="ใบงาน">
                        <button
                          className="table-link"
                          onClick={() => onOpen("workOrders", x._id)}
                        >
                          {displayDocumentNumber(x.number)}
                        </button>
                      </td>
                      <td data-label="หัวข้อ">{x.title}</td>
                      <td
                        data-label="กำหนดเสร็จ"
                        className={
                          x.dueAt && new Date(x.dueAt) < now!
                            ? "dash-overdue"
                            : ""
                        }
                      >
                        {x.dueAt ? date(x.dueAt) : "ไม่ระบุ"}
                      </td>
                      <td data-label="สถานะ">
                        <span className={"badge " + x.status}>
                          {labels[x.status] || x.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">ไม่มีใบงานคงค้าง</p>
          )}
        </section>
        <section className="panel">
          <div className="dash-panel-title">
            <h2>ใบแจ้งซ่อมล่าสุด</h2>
            <button
              className="ghost"
              onClick={() => onNavigate("repairRequests")}
            >
              ทั้งหมด →
            </button>
          </div>
          {data.recent.length ? (
            data.recent.map((x) => (
              <button
                className="dash-recent"
                key={x._id}
                onClick={() => onOpen("repairRequests", x._id)}
              >
                <span className="dash-recent-mark">▤</span>
                <span>
                  <b>{displayDocumentNumber(x.number)}</b>
                  <span>{x.title}</span>
                  <small>
                    {date(x.createdAt)} · {labels[x.status] || x.status}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p className="empty">ยังไม่มีใบแจ้งซ่อม</p>
          )}
        </section>
      </div>
    </div>
  );
}
