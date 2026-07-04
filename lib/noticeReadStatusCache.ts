type NoticeReadStatus = {
  userId: string;
  readNoticeIds: string[];
  unreadNoticeIds: string[];
};

// 공지 읽음 상태의 세션 내 인메모리 캐시(stale-while-revalidate용).
// 확인된 서버 응답만 저장하고, 재진입 시 이 값을 즉시 표시한 뒤 백그라운드 재검증한다.
// 로그아웃이 모듈 캐시를 지우지 않으므로 userId를 함께 저장해 계정이 바뀌면 miss 처리.
let cache: NoticeReadStatus | null = null;

export const getNoticeReadStatusCache = (
  userId: string | null | undefined
): NoticeReadStatus | null =>
  userId && cache && cache.userId === userId ? cache : null;

export const setNoticeReadStatusCache = (value: NoticeReadStatus) => {
  cache = value;
};

// 공지 상세에서 읽음 처리 성공 직후 호출 — 재검증을 기다리지 않고 로컬에서 즉시 반영
export const markNoticeReadInCache = (userId: string, noticeId: string) => {
  if (!cache || cache.userId !== userId) return;
  cache = {
    userId,
    readNoticeIds: cache.readNoticeIds.includes(noticeId)
      ? cache.readNoticeIds
      : [...cache.readNoticeIds, noticeId],
    unreadNoticeIds: cache.unreadNoticeIds.filter((id) => id !== noticeId),
  };
};
