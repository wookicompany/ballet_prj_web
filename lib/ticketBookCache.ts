export type TicketSummary = {
  id: string;
  watchedOn: string;
  title: string;
  venue: string | null;
  rating: number | null;
  // 썸네일 우선순위: KOPIS 포스터 → 첨부 이미지 1번째 → null(플레이스홀더).
  // 판정은 반드시 truthy 체크로 한다 — kopis_performances.poster는 NULL이 0건이고
  // 빈 문자열("")이 23건 존재해서, `!== null` 방식으로 짜면 <img src="">가 렌더된다.
  thumbnailUrl: string | null;
  isCustom: boolean;
};

type TicketMonthData = {
  // watched_on(YYYY-MM-DD) → 그날의 티켓들. 같은 날 안에서는 created_at 오름차순이라
  // 셀의 대표 포스터(첫 항목)와 하단 목록 첫 항목이 항상 일치한다.
  ticketsByDate: Record<string, TicketSummary[]>;
};

type TicketBookNavState = {
  year: number;
  month: number;
  selectedDate: string;
};

// 월별 fetch 데이터 캐시.
//
// 무효화는 "맵 전체 비우기"로만 처리한다. lib/calendarHomeCache.ts가 과거에 전역 dirty
// boolean 방식을 쓰다 교정된 이력이 있는데, 그 방식은 무효화 후 첫 달을 재조회하는 순간
// 플래그가 리셋되어 세션 중 이미 캐시돼 있던 *다른* 달이 stale로 남는 문제가 있었다.
// 티켓북은 처음부터 map-clear로 시작해 같은 함정을 피한다.
const monthDataMap = new Map<string, TicketMonthData>();

// 내비게이션 상태(월 이동·날짜 선택 복원용). 캐시 무효화와 무관하게 항상 최신을 유지한다.
let navState: TicketBookNavState | null = null;

export const getTicketBookMonthData = (monthKey: string): TicketMonthData | null =>
  monthDataMap.get(monthKey) ?? null;

export const setTicketBookMonthData = (
  monthKey: string,
  data: TicketMonthData
): void => {
  monthDataMap.set(monthKey, data);
};

export const invalidateTicketBookCache = (): void => {
  monthDataMap.clear();
};

export const getTicketBookNavState = (): TicketBookNavState | null => navState;

export const setTicketBookNavState = (state: TicketBookNavState): void => {
  navState = state;
};

// ─────────────────────────────────────────────────────────────────────────────
// dirty flag — 티켓 생성·수정·삭제 후 티켓북으로 돌아올 때 캐시를 비우기 위한 시그널.
// records의 `record-changed:*` 패턴을 그대로 본떴다. sessionStorage는 프라이빗 모드나
// 스토리지 차단 설정에서 접근 자체가 throw할 수 있으므로 전부 try/catch로 감싼다.
// ─────────────────────────────────────────────────────────────────────────────
const DIRTY_PREFIX = "ticket-changed:";

export const markTicketChanged = (ticketId: string): void => {
  try {
    sessionStorage.setItem(`${DIRTY_PREFIX}${ticketId}`, "1");
  } catch {
    // 스토리지를 못 쓰면 캐시 무효화 시그널을 남길 수 없다. 조용히 넘어가되,
    // 티켓북 진입 시 pageshow(bfcache 복귀) 경로에서 어차피 재조회된다.
  }
};

// dirty 시그널이 있으면 전부 지우고 true를 돌려준다(= 이번 진입은 force 재조회).
export const consumeTicketChanged = (): boolean => {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(DIRTY_PREFIX)) keys.push(key);
    }
    if (keys.length === 0) return false;
    keys.forEach((key) => sessionStorage.removeItem(key));
    return true;
  } catch {
    return false;
  }
};
