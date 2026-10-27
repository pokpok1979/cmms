"use client";
import { useEffect, useState } from "react";
import { auditPageNumbers } from "@/lib/audit-pagination";
import "./pagination.css";

export function useClientPagination<T>(items: T[], resetKey = "") {
  const [requestedPage, setPage] = useState(1);
  const [previousKey, setPreviousKey] = useState(resetKey);
  const pageCount = Math.max(1, Math.ceil(items.length / 20));
  const page = previousKey === resetKey ? Math.min(requestedPage, pageCount) : 1;
  useEffect(() => { setPreviousKey(resetKey); setPage(1); }, [resetKey]);
  useEffect(() => { setPage(current => Math.min(current, pageCount)); }, [pageCount]);
  return { page, setPage, items: items.slice((page - 1) * 20, page * 20) };
}

export default function Pagination({ page, total, pageSize = 20, count, loading = false, onChange }: {
  page: number; total: number; pageSize?: number; count?: number; loading?: boolean; onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.max(1, Math.min(page, pages));
  const start = total && count !== 0 ? (current - 1) * pageSize + 1 : 0;
  const end = start ? Math.min(total, (current - 1) * pageSize + (count ?? pageSize)) : 0;
  return <div className="cmms-pagination" aria-busy={loading}>
    <span role="status">แสดง <b>{start.toLocaleString("th-TH")}–{end.toLocaleString("th-TH")}</b> จาก <b>{total.toLocaleString("th-TH")}</b> รายการ</span>
    <nav aria-label="แบ่งหน้ารายการ">
      <button type="button" aria-label="หน้าก่อนหน้า" disabled={loading || current <= 1} onClick={() => onChange(current - 1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4-8 8 8 8" /></svg></button>
      {auditPageNumbers(current, pages).map((number, index) => number === "ellipsis"
        ? <span className="cmms-page-gap" key={`gap-${index}`} aria-hidden="true">…</span>
        : <button type="button" key={number} aria-label={`หน้า ${number}`} aria-current={number === current ? "page" : undefined} disabled={loading} onClick={() => onChange(number)}>{number}</button>)}
      <button type="button" aria-label="หน้าถัดไป" disabled={loading || current >= pages} onClick={() => onChange(current + 1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4 8 8-8 8" /></svg></button>
    </nav>
  </div>;
}
