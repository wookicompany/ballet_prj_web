// 공연의 진행 상태는 kopis_performances.prfstate를 쓰지 않고, 공연 기간과 오늘 날짜를
// 비교해 조회 시점에 판정한다.
//
// prfstate는 KOPIS 응답값을 그대로 저장하는 컬럼인데(lib/kopis.ts의 mapKopisListItem),
// 동기화 대상 범위가 '오늘 ~ +365일'이라 공연이 끝나는 순간 KOPIS 응답에서 빠지고
// DB 행이 마지막 상태 그대로 굳는다. 실제로 종료일이 3주 지났는데 '공연중'으로,
// 7개월 지났는데 '공연예정'으로 남은 공연이 있었다. 날짜로 판정하면 이 문제가 없고
// 자정을 넘길 때 별도 보정 없이 자동으로 다음 상태가 된다.
//
// 날짜는 "YYYY-MM-DD"(lib/kstDateTime.ts의 formatSeoulDateKey) 형식이라 사전순 비교가
// 곧 날짜 비교다.

export type PerformanceState = "ongoing" | "scheduled" | "completed" | "unknown";

export const getPerformanceState = (
  prfpdfrom: string | null | undefined,
  prfpdto: string | null | undefined,
  todayDateKey: string
): PerformanceState => {
  // 기간을 모르면 어느 섹션에도 넣지 않는다. 현재 활성 공연 중 기간이 비어 있는 행은
  // 없지만, 생기더라도 "지금 관람할 수 있다"고 단정할 수 없다.
  if (!prfpdfrom || !prfpdto) return "unknown";
  if (prfpdto < todayDateKey) return "completed";
  if (prfpdfrom > todayDateKey) return "scheduled";
  return "ongoing";
};

// "내가 본 공연"처럼 상태를 섞어 보여주는 목록의 정렬 우선순위.
export const PERFORMANCE_STATE_ORDER: Record<PerformanceState, number> = {
  ongoing: 0,
  scheduled: 1,
  completed: 2,
  unknown: 3,
};
