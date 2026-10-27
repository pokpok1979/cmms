import { z } from "zod";
import type { User } from "./domain";
export const settingFieldLabels = {
  companyNameTh: "ชื่อบริษัท (ไทย)",
  companyNameEn: "ชื่อบริษัท (อังกฤษ)",
  taxId: "เลขประจำตัวผู้เสียภาษี",
  phone: "โทรศัพท์",
  email: "อีเมล",
  website: "เว็บไซต์",
  address: "ที่อยู่",
  plantName: "ชื่อโรงงาน / สถานที่",
  workingDays: "วัน-เวลาทำงาน",
  normalHours: "กำหนดเสร็จงานปกติ",
  highHours: "กำหนดเสร็จงานเร่งด่วน",
  urgentHours: "กำหนดเสร็จงานฉุกเฉิน",
} as const;
const text = (max: number) => z.string().trim().max(max);
export const settingsValuesSchema = z
  .object({
    companyNameTh: text(200).min(1),
    companyNameEn: text(200),
    taxId: text(13).refine(
      (value) => !value || /^\d{13}$/.test(value),
      "เลขผู้เสียภาษีต้องมี 13 หลัก",
    ),
    phone: text(50).regex(/^[0-9+().\s-]*$/),
    email: z.union([z.literal(""), z.email().max(150)]),
    website: text(150),
    address: text(500),
    plantName: text(150).min(1),
    workingDays: text(150),
    normalHours: z.number().int().min(1).max(8760),
    highHours: z.number().int().min(1).max(8760),
    urgentHours: z.number().int().min(1).max(8760),
  })
  .strict();
export const settingsSaveSchema = settingsValuesSchema
  .extend({
    companyId: text(100).min(1),
    siteId: text(100).min(1),
    revision: z.number().int().min(0),
  })
  .refine(
    (value) =>
      value.urgentHours <= value.highHours &&
      value.highHours <= value.normalHours,
    {
      message: "ระยะเวลางานฉุกเฉินต้องไม่เกินงานเร่งด่วนและงานปกติ",
      path: ["urgentHours"],
    },
  );
export type SettingsValues = z.infer<typeof settingsValuesSchema>;
export type SiteSettings = SettingsValues & {
  companyId: string;
  siteId: string;
  revision: number;
  updatedAt?: string | null;
};
export function settingsDefaults(
  companyName = "",
  plantName = "",
): SettingsValues {
  return {
    companyNameTh: companyName,
    companyNameEn: "",
    taxId: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    plantName,
    workingDays: "",
    normalHours: 72,
    highHours: 24,
    urgentHours: 4,
  };
}
export function canManageSettings(
  actor: Pick<User, "role" | "grants">,
  target: { companyId: string; siteId: string },
) {
  return (
    actor.role === "admin" &&
    actor.grants.some(
      (grant) =>
        grant.companyId === target.companyId && grant.siteId === target.siteId,
    )
  );
}
export function settingsId(companyId: string, siteId: string) {
  return `site-settings:${encodeURIComponent(companyId)}:${encodeURIComponent(siteId)}`;
}
export function settingsValues(
  record: Partial<SettingsValues> | Record<string, unknown>,
  defaults: SettingsValues,
): SettingsValues {
  const values = { ...defaults };
  for (const key of Object.keys(
    settingFieldLabels,
  ) as (keyof SettingsValues)[]) {
    if (record[key] !== undefined)
      Object.assign(values, { [key]: record[key] });
  }
  return values;
}
export function settingsChangedFields(
  previous: SettingsValues,
  next: SettingsValues,
) {
  return (Object.keys(settingFieldLabels) as (keyof SettingsValues)[]).filter(
    (key) => previous[key] !== next[key],
  );
}
export function workOrderDeadline(
  priority: string,
  settings: Partial<SettingsValues> | Record<string, unknown> | null,
  now: Date,
) {
  const key =
    priority === "urgent"
      ? "urgentHours"
      : priority === "high"
        ? "highHours"
        : "normalHours";
  const configured = settings?.[key];
  const hours =
    typeof configured === "number" &&
    Number.isInteger(configured) &&
    configured >= 1 &&
    configured <= 8760
      ? configured
      : settingsDefaults()[key];
  return new Date(now.getTime() + hours * 3600000);
}
