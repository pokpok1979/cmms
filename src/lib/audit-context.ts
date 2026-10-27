import { isIP } from "node:net";

export function normalizeAuditIPv4(value: string | null | undefined): string {
  const address = value?.trim() || "";
  if (isIP(address) === 4) return address;
  if (isIP(address) !== 6) return "";
  // IPv4-mapped IPv6 carries the original IPv4 address in its final 32 bits.
  const mapped = /^(?:::ffff:|0:0:0:0:0:ffff:)(.+)$/i.exec(address);
  if (!mapped) return "";
  if (isIP(mapped[1]) === 4) return mapped[1];
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(mapped[1]);
  if (!hex) return "";
  const high = parseInt(hex[1], 16), low = parseInt(hex[2], 16);
  return [high >>> 8, high & 255, low >>> 8, low & 255].join(".");
}

export function auditContext(req: Request) {
  const kind = new URL(req.url).pathname.split("/")[2];
  const address = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip");
  return {
    ip: normalizeAuditIPv4(address),
    entityType: kind === "admin-users" ? "users" : kind,
  };
}
