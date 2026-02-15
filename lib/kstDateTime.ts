export const KST_TIME_ZONE = "Asia/Seoul";

export type DateKeyParts = {
  year: number;
  month: number;
  day: number;
};

const getFormatterParts = (
  date: Date,
  options: Intl.DateTimeFormatOptions
) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIME_ZONE,
    ...options,
  }).formatToParts(date);
};

export const getSeoulDateParts = (date: Date = new Date()): DateKeyParts => {
  const parts = getFormatterParts(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "0"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "1"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "1"),
  };
};

export const formatSeoulDateKey = (date: Date = new Date()): string => {
  const { year, month, day } = getSeoulDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
};

export const parseDateKey = (value: string): Date | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
};

export const isValidDateKey = (value: string): boolean => parseDateKey(value) !== null;

export const getSeoulTodayDate = (): Date => {
  const { year, month, day } = getSeoulDateParts();
  return new Date(year, month - 1, day);
};

export const getSeoulTimeParts = (date: Date = new Date()) => {
  const parts = getFormatterParts(date, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? "0"),
  };
};

const getUtcDayNumber = (year: number, month: number, day: number) =>
  Math.floor(Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000));

export const getDateKeyDiffDays = (
  targetDateKey: string,
  baseDateKey: string = formatSeoulDateKey()
): number | null => {
  const target = parseDateKey(targetDateKey);
  const base = parseDateKey(baseDateKey);
  if (!target || !base) return null;

  const targetDay = getUtcDayNumber(
    target.getFullYear(),
    target.getMonth() + 1,
    target.getDate()
  );
  const baseDay = getUtcDayNumber(
    base.getFullYear(),
    base.getMonth() + 1,
    base.getDate()
  );
  return targetDay - baseDay;
};

export const formatIsoToSeoulDate = (
  value: string,
  locale: string = "ko-KR"
): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    timeZone: KST_TIME_ZONE,
  }).format(date);
};
