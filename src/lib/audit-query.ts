import { ApiError } from "./auth";
export function auditDateRange(from: string | null, to: string | null) {
  const range: { $gte?: Date; $lt?: Date } = {};
  for (const [key,value] of [["$gte",from],["$lt",to]] as const) {
    if (!value) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400,"วันที่ไม่ถูกต้อง");
    const date = new Date(value+"T00:00:00+07:00");
    if (!Number.isFinite(date.getTime()) || new Date(date.getTime()+7*3600000).toISOString().slice(0,10)!==value) throw new ApiError(400,"วันที่ไม่ถูกต้อง");
    range[key] = key === "$lt" ? new Date(date.getTime()+86400000) : date;
  }
  if (range.$gte && range.$lt && range.$gte >= range.$lt) throw new ApiError(400,"วันเริ่มต้นต้องไม่เกินวันสิ้นสุด");
  return range;
}