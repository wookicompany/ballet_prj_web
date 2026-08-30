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

// 월별 fetch 데이터 캐시.
// 무효화는 "맵 전체 비우기"로 처리한다(과거의 전역 dirty boolean 방식은, 무효화 후 첫 달을
// 재조회하는 순간 플래그가 리셋되어 세션 중 이미 캐시돼 있던 *다른* 달이 stale로 남는 문제가
// 있었다 — 반복 예정은 여러 달에 걸쳐 생성되므로 이 stale이 실제 버그가 된다). 무효화는
// record-changed 시그널이 있을 때(=데이터가 실제로 바뀌었을 때)만 호출되므로 전체 clear가 안전하다.
const monthDataMap = new Map<string, CalendarMonthData>();

// 내비게이션 상태 (월 이동·날짜 선택 복원용, 캐시 무효화와 무관하게 항상 최신)
let navState: CalendarNavState | null = null;

export const getCalendarMonthData = (monthKey: string): CalendarMonthData | null => {
  return monthDataMap.get(monthKey) ?? null;
};

export const setCalendarMonthData = (monthKey: string, data: CalendarMonthData): void => {
  monthDataMap.set(monthKey, data);
};

export const invalidateCalendarCache = (): void => {
  monthDataMap.clear();
};

export const getCalendarNavState = (): CalendarNavState | null => navState;

export const setCalendarNavState = (state: CalendarNavState): void => {
  navState = state;
};
