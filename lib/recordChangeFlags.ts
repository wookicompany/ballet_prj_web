// §11.3(recurring-planned-records.md): dirty-flag helper for writes that touch MULTIPLE dates at
// once (반복 생성, "남은 예정 전체 삭제"). Two different consumers read this same
// `record-changed:{date}` sessionStorage key prefix differently:
//   - app/(tabs)/calendar/page.tsx treats ANY key with this prefix as "refetch the current
//     month" (it doesn't check the date value) — a single key would already be enough for it.
//   - app/day/[date]/page.tsx checks its own EXACT `record-changed:{date}` key — if a date
//     that changed never gets its own key, that day's timeline stays stale until a hard refresh.
// So every affected date needs its own key. Single-date call sites (record/new, record/[id],
// record/[id]/edit) keep writing sessionStorage directly since one date is already enough there —
// this helper only exists for the multi-date cases.
export const markRecordDatesChanged = (dates: string[]): void => {
  dates.forEach((date) => {
    if (!date) return;
    sessionStorage.setItem(`record-changed:${date}`, "1");
  });
};
