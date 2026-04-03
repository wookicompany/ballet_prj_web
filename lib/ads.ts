import { KST_TIME_ZONE } from "@/lib/kstDateTime";

export const AD_PLACEMENTS = [
  "performance_home",
  "brand_home",
] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export const isAdPlacement = (value: string): value is AdPlacement =>
  AD_PLACEMENTS.includes(value as AdPlacement);

export const isValidHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const parseKstDateTimeInputToIso = (value: string): string | null => {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/
  );
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:00+09:00`
  );
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const toKstDateTimeInputValue = (value: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  if (!year || !month || !day || !hour || !minute) return "";
  return `${year}-${month}-${day}T${hour}:${minute}`;
};
