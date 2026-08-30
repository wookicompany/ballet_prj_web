type CalendarMonthData = {
  // 완료(status='done') 기록 개수 — 캘린더 셀의 채움 배지에 쓰인다.
  doneCounts: Record<string, number>;
  // 예정(status='planned') 기록 개수 — 캘린더 셀의 outline 배지/점선 원에 쓰인다.
  plannedCounts: Record<string, number>;
  moodAverages: Record<string, number>;
  monthSummary: { count: number; mins: number; days: number } | null;
};

type CalendarNavState = {
  year: number;
  month: number;
  selectedDate: string;
};

// 월별 fetch 데이터 (dirty flag로 invalidation 제어)
const monthDataMap = new Map<string, CalendarMonthData>();
let monthDataDirty = false;

// 내비게이션 상태 (월 이동·날짜 선택 복원용, dirty flag 없이 항상 최신)
let navState: CalendarNavState | null = null;

export const getCalendarMonthData = (monthKey: string): CalendarMonthData | null => {
  if (monthDataDirty) return null;
  return monthDataMap.get(monthKey) ?? null;
};

export const setCalendarMonthData = (monthKey: string, data: CalendarMonthData): void => {
  monthDataMap.set(monthKey, data);
  monthDataDirty = false;
};

export const invalidateCalendarCache = (): void => {
  monthDataDirty = true;
};

export const getCalendarNavState = (): CalendarNavState | null => navState;

export const setCalendarNavState = (state: CalendarNavState): void => {
  navState = state;
};
