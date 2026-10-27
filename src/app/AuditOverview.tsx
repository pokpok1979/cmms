"use client";
import { useEffect, useId, useState } from "react";
import { auditModules } from "@/lib/audit-display";
import type { AuditDay, AuditOverviewData } from "@/lib/audit-overview";
import "./audit-overview.css";
const format = (value: number) => value.toLocaleString("th-TH");
function dayLabel(value: string, full = false) {
  return new Date(value + "T00:00:00+07:00").toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: full ? "long" : "short",
    ...(full ? { year: "numeric" as const } : {}),
  });
}
function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    function tick(time: number) {
      const progress = Math.min((time - start) / 650, 1);
      setDisplay(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{format(display)}</>;
}
function MetricIcon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    activity: "M2 12h5l3-8 4 16 3-8h5",
    users: "M15 8a3 3 0 1 0-6 0a3 3 0 1 0 6 0 M5 21v-3a7 7 0 0 1 14 0v3",
    login: "M13 3h7v18h-7 M3 12h13 M12 8l4 4-4 4",
    total: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="23"
      height="23"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}
function ChartTooltip({
  day,
  id,
  single = false,
}: {
  day: AuditDay;
  id: string;
  single?: boolean;
}) {
  return (
    <div className="audit-overview-tooltip" id={id} role="tooltip">
      <strong>{dayLabel(day.date, true)}</strong>
      <div>
        <span>
          <i className="audit-series-activity" />
          กิจกรรม (Audit)
        </span>
        <b>{format(day.activities)}</b>
      </div>
      {!single && (
        <div>
          <span>
            <i className="audit-series-login" />
            เข้าสู่ระบบสำเร็จ
          </span>
          <b>{format(day.logins)}</b>
        </div>
      )}
    </div>
  );
}
function Sparkline({ days }: { days: AuditDay[] }) {
  const [hover, setHover] = useState<number | null>(null),
    tooltipId = useId();
  const max = Math.max(1, ...days.map((day) => day.activities));
  const point = (day: AuditDay, index: number) => ({
    x: 8 + (index * 284) / Math.max(days.length - 1, 1),
    y: 49 - (day.activities / max) * 40,
  });
  return (
    <div className="audit-sparkline" onPointerLeave={() => setHover(null)}>
      {hover !== null && (
        <ChartTooltip day={days[hover]} id={tooltipId} single />
      )}
      <svg viewBox="0 0 300 58" role="group" aria-label="แนวโน้มกิจกรรม 14 วัน">
        <polyline
          className="audit-animated-line"
          points={days
            .map((day, index) => {
              const p = point(day, index);
              return `${p.x},${p.y}`;
            })
            .join(" ")}
          fill="none"
          stroke="#00a47c"
          strokeWidth="2"
          pathLength="1"
        />
        {days.map((day, index) => {
          const p = point(day, index);
          return (
            <g
              key={day.date}
              tabIndex={0}
              aria-label={`${dayLabel(day.date, true)} กิจกรรม ${format(day.activities)} รายการ`}
              aria-describedby={hover === index ? tooltipId : undefined}
              onPointerEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setHover(null);
              }}
            >
              <rect
                x={p.x - 10}
                y="0"
                width="20"
                height="58"
                fill="transparent"
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={hover === index ? 4 : 0}
                fill="#00a47c"
                stroke="#fff"
                strokeWidth="2"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
function DailyChart({
  days,
  mode,
}: {
  days: AuditDay[];
  mode: "bar" | "line";
}) {
  const [hover, setHover] = useState<number | null>(null),
    tooltipId = useId();
  const largest = Math.max(
    1,
    ...days.flatMap((day) => [day.activities, day.logins]),
  );
  const magnitude = 10 ** Math.floor(Math.log10(largest / 4));
  const step =
    [1, 2, 5, 10]
      .map((value) => value * magnitude)
      .find((value) => value >= largest / 4) || largest / 4;
  const top = Math.max(4, step * 4),
    left = 52,
    right = 882,
    bottom = 247,
    height = 185;
  const groupWidth = (right - left) / Math.max(days.length, 1),
    x = (index: number) => left + groupWidth * (index + 0.5),
    y = (value: number) => bottom - (value / top) * height;
  return (
    <div className="audit-daily-chart" onPointerLeave={() => setHover(null)}>
      {hover !== null && <ChartTooltip day={days[hover]} id={tooltipId} />}
      <svg
        viewBox="0 0 900 285"
        role="group"
        aria-label={
          mode === "bar"
            ? "กราฟแท่งเปรียบเทียบกิจกรรมและการเข้าสู่ระบบรายวัน"
            : "กราฟเส้นกิจกรรมและการเข้าสู่ระบบรายวัน"
        }
      >
        {[0, 1, 2, 3, 4].map((index) => (
          <g key={index} aria-hidden="true">
            <line
              x1={left}
              x2={right}
              y1={y((index * top) / 4)}
              y2={y((index * top) / 4)}
              stroke="#e9efec"
            />
            <text x={left - 8} y={y((index * top) / 4) + 4} textAnchor="end">
              {format((index * top) / 4)}
            </text>
          </g>
        ))}
        {mode === "line" && (
          <g aria-hidden="true">
            <polyline
              className="audit-animated-line"
              points={days
                .map((day, index) => `${x(index)},${y(day.activities)}`)
                .join(" ")}
              fill="none"
              stroke="#12b886"
              strokeWidth="2.5"
              pathLength="1"
            />
            <polyline
              className="audit-animated-line"
              points={days
                .map((day, index) => `${x(index)},${y(day.logins)}`)
                .join(" ")}
              fill="none"
              stroke="#448ce6"
              strokeWidth="2.5"
              pathLength="1"
            />
          </g>
        )}
        {days.map((day, index) => (
          <g
            key={day.date}
            className={
              hover === index ? "audit-chart-day hovered" : "audit-chart-day"
            }
            tabIndex={0}
            aria-label={`${dayLabel(day.date, true)} กิจกรรม ${format(day.activities)} รายการ เข้าสู่ระบบสำเร็จ ${format(day.logins)} ครั้ง`}
            aria-describedby={hover === index ? tooltipId : undefined}
            onPointerEnter={() => setHover(index)}
            onFocus={() => setHover(index)}
            onBlur={() => setHover(null)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setHover(null);
            }}
          >
            <rect
              x={left + index * groupWidth}
              y="50"
              width={groupWidth}
              height={bottom - 50}
              fill={hover === index ? "#eaf8f250" : "transparent"}
            />
            {mode === "bar" ? (
              <g
                className="audit-animated-bars"
                style={{
                  transformOrigin: `${x(index)}px ${bottom}px`,
                  animationDelay: `${index * 20}ms`,
                }}
              >
                <rect
                  className="audit-activity-bar"
                  x={x(index) - groupWidth * 0.3}
                  y={day.activities ? y(day.activities) : bottom - 2}
                  width={groupWidth * 0.27}
                  height={Math.max(2, (day.activities / top) * height)}
                  rx="3"
                  fill={hover === index ? "#048c64" : "#28ad88"}
                />
                <rect
                  className="audit-login-bar"
                  x={x(index) + groupWidth * 0.03}
                  y={day.logins ? y(day.logins) : bottom - 2}
                  width={groupWidth * 0.27}
                  height={Math.max(2, (day.logins / top) * height)}
                  rx="3"
                  fill={hover === index ? "#2367ba" : "#4e91e0"}
                />
              </g>
            ) : (
              <g>
                <circle
                  cx={x(index)}
                  cy={y(day.activities)}
                  r={hover === index ? 5 : 3}
                  fill="#12b886"
                  stroke="#fff"
                  strokeWidth="1.5"
                />
                <circle
                  cx={x(index)}
                  cy={y(day.logins)}
                  r={hover === index ? 5 : 3}
                  fill="#448ce6"
                  stroke="#fff"
                  strokeWidth="1.5"
                />
              </g>
            )}
            <text x={x(index)} y={bottom + 24} textAnchor="middle">
              {dayLabel(day.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
export default function AuditOverview({
  data,
  loading,
}: {
  data: AuditOverviewData | undefined;
  loading: boolean;
}) {
  const [mode, setMode] = useState<"bar" | "line" | "table">("bar");
  const today = data?.days.at(-1)?.date;
  const isToday =
    today ===
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const cards = [
    {
      title: isToday
        ? "กิจกรรมวันนี้"
        : `กิจกรรม${today ? ` · ${dayLabel(today)}` : "วันนี้"}`,
      value: data?.todayActivities || 0,
      unit: "รายการ",
      note: "เทียบกับวันก่อนหน้า",
      icon: "activity",
    },
    {
      title: isToday
        ? "ผู้ใช้งานวันนี้"
        : `ผู้ใช้งาน${today ? ` · ${dayLabel(today)}` : "วันนี้"}`,
      value: data?.todayUsers || 0,
      unit: "คน",
      note: "นับจากกิจกรรมและการเข้าสู่ระบบ",
      icon: "users",
    },
    {
      title: "เข้าสู่ระบบสำเร็จ (7 วัน)",
      value: data?.loginsWeek || 0,
      unit: "ครั้ง",
      note: "การเข้าสู่ระบบที่บันทึกสำเร็จ",
      icon: "login",
    },
    {
      title: "กิจกรรมทั้งหมด (14 วัน)",
      value: data?.total || 0,
      unit: "รายการ",
      note: "รวมกิจกรรมและการเข้าสู่ระบบ",
      icon: "total",
    },
  ];
  const maxModule = Math.max(
    1,
    ...(data?.modules || []).map((row) => row.count),
  );
  return (
    <div className="audit-overview" aria-busy={loading}>
      <div className="audit-overview-metrics">
        {cards.map((card, index) => (
          <article
            className={`audit-overview-card card-${card.icon}`}
            key={card.icon}
          >
            <div className="audit-card-top">
              <span className="audit-metric-icon">
                <MetricIcon kind={card.icon} />
              </span>
              {index === 0 &&
                data?.changePercent !== null &&
                data?.changePercent !== undefined && (
                  <span
                    className={
                      data.changePercent >= 0
                        ? "audit-change"
                        : "audit-change negative"
                    }
                  >
                    {data.changePercent >= 0 ? "↗" : "↘"}{" "}
                    {Math.abs(data.changePercent).toLocaleString("th-TH", {
                      maximumFractionDigits: 1,
                    })}
                    %
                  </span>
                )}
            </div>
            <p>{card.title}</p>
            <strong>
              {!data ? "—" : <AnimatedCount value={card.value} />}
              <small>{card.unit}</small>
            </strong>
            <span className="audit-card-note">{card.note}</span>
            {index === 0 && data && <Sparkline days={data.days} />}
          </article>
        ))}
      </div>
      <div className="audit-overview-chart-grid">
        <section className="audit-overview-panel">
          <header>
            <div>
              <MetricIcon kind="activity" />
              <h3>กิจกรรมในระบบรายวัน</h3>
              <span>14 วันล่าสุด (รายการ)</span>
            </div>
            <div className="audit-chart-tabs" aria-label="รูปแบบกราฟ">
              {(
                [
                  ["bar", "กราฟแท่ง"],
                  ["line", "กราฟเส้น"],
                  ["table", "ตาราง"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={mode === value ? "selected" : ""}
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>
          {!data ? (
            <p className="audit-overview-empty">
              {loading ? "กำลังโหลดภาพรวมกิจกรรม…" : "ยังไม่มีข้อมูลภาพรวม"}
            </p>
          ) : mode === "table" ? (
            <div className="audit-chart-table-scroll">
              <table className="audit-chart-table">
                <caption className="sr-only">
                  กิจกรรมและการเข้าสู่ระบบรายวัน
                </caption>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>กิจกรรม (Audit)</th>
                    <th>เข้าสู่ระบบสำเร็จ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((day) => (
                    <tr key={day.date}>
                      <td>{dayLabel(day.date, true)}</td>
                      <td>{format(day.activities)}</td>
                      <td>{format(day.logins)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <div className="audit-chart-legend">
                <span>
                  <i className="audit-series-activity" />
                  กิจกรรม (Audit)
                </span>
                <span>
                  <i className="audit-series-login" />
                  เข้าสู่ระบบสำเร็จ
                </span>
              </div>
              <div className="audit-chart-scroll">
                <DailyChart days={data.days} mode={mode} />
              </div>
            </>
          )}
        </section>
        <section className="audit-overview-panel audit-module-ranking">
          <header>
            <div>
              <MetricIcon kind="total" />
              <h3>โมดูลที่มีกิจกรรมมากที่สุด</h3>
              <span>14 วัน</span>
            </div>
          </header>
          <div className="audit-module-bars">
            {!data?.modules.length ? (
              <p className="audit-overview-empty">
                {loading ? "กำลังโหลด…" : "ยังไม่มีกิจกรรมในช่วงนี้"}
              </p>
            ) : (
              data.modules.map((row) => (
                <div className="audit-module-row" key={row.module}>
                  <div>
                    <span>{auditModules[row.module] || "อื่น ๆ"}</span>
                    <strong>{format(row.count)}</strong>
                  </div>
                  <div className="audit-module-track">
                    <span
                      style={{ width: `${(row.count / maxModule) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
