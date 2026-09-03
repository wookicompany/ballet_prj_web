export const KST_TIME_ZONE = "Asia/Seoul";

export type DateKeyParts = {
  year: number;
  month: number;
  day: number;
};

export type YearMonthParts = {
  year: number;
  month: number;
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

export const getSeoulYearMonthParts = (
  date: Date = new Date()
): YearMonthParts => {
  const { year, month } = getSeoulDateParts(date);
  return { year, month };
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

/**
 * 24시간 hour(0~23)를 "오전"/"오후"로 표기한다. 자정(0시)은 "오전", 정오(12시)는 "오후".
 */
export const getMeridiemLabel = (hour24: number): "오전" | "오후" =>
  hour24 < 12 ? "오전" : "오후";

/**
 * 24시간 hour(0~23)를 12시간 표기용 시(1~12)로 변환한다. 0시·12시는 모두 12로 정규화된다.
 */
export const getHour12 = (hour24: number): number => {
  const normalized = hour24 % 12;
  return normalized === 0 ? 12 : normalized;
};

/**
 * "HH:MM"(24시간) 문자열을 "오후 6시 30분" 형식(12시간, zero-pad 없음)으로 표기한다.
 * 입력·상세 화면 등 12시간 표기가 필요한 곳에서 공통으로 사용한다.
 */
export const formatKoreanTimeLabel = (time: string): string => {
  const [hourStr, minuteStr] = time.split(":");
  const hourValue = Number(hourStr);
  if (!minuteStr || Number.isNaN(hourValue)) return time;
  return `${getMeridiemLabel(hourValue)} ${getHour12(hourValue)}시 ${minuteStr}분`;
};

export const formatCareerDuration = (
  startDateKeyOrDate: string | Date
): string | null => {
  const startDate =
    typeof startDateKeyOrDate === "string"
      ? parseDateKey(startDateKeyOrDate)
      : startDateKeyOrDate;
  if (!startDate) return null;

  const today = getSeoulTodayDate();
  if (startDate.getTime() > today.getTime()) return null;

  let totalMonths =
    (today.getFullYear() - startDate.getFullYear()) * 12 +
    (today.getMonth() - startDate.getMonth());

  if (today.getDate() < startDate.getDate()) {
    totalMonths -= 1;
  }
  if (totalMonths < 0) return null;

  if (totalMonths < 12) return `${totalMonths}개월`;

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return `${years}년 ${months}개월`;
};
