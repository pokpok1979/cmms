export function notificationTime(at: string, now = Date.now()) {
  const timestamp = new Date(at).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "เมื่อสักครู่";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} วันที่แล้ว`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} เดือนที่แล้ว`;
  return `${Math.floor(seconds / 31536000)} ปีที่แล้ว`;
}
