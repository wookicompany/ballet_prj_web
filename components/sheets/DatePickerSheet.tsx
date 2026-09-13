"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

import BottomSheet from "@/components/sheets/BottomSheet";
import { Button } from "@/components/ui/button";
import { getSeoulDateParts, getSeoulTodayDate, parseDateKey } from "@/lib/kstDateTime";

type DatePickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** YYYY-MM-DD. 비어 있으면 오늘(KST)을 기준으로 연다. */
  value: string;
  onConfirm: (next: string) => void;
  /** 선택 가능한 연도 범위(현재 연도 기준). 기본은 기록 작성과 동일하게 -2 ~ +3년. */
  yearsBefore?: number;
  yearsAfter?: number;
};

/**
 * 기록 작성·수정 화면이 쓰던 연/월/일 3열 날짜 선택 시트를 컴포넌트로 뺀 것.
 * 티켓북도 같은 시트를 쓰게 해서 날짜 입력 경험을 하나로 맞춘다.
 * (네이티브 <input type="date">는 OS마다 모양이 달라 앱 안에서 이질적이다.)
 */
export default function DatePickerSheet({ open, onOpenChange, ...rest }: DatePickerSheetProps) {
  // 본문을 열려 있을 때만 마운트한다. 그러면 draft를 useState 초기값으로 한 번만 잡으면
  // 되고, "열릴 때마다 현재 값으로 되돌리는" effect가 필요 없다(effect 안에서 동기적으로
  // setState하면 연쇄 렌더를 유발한다).
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      {open ? <DatePickerBody onOpenChange={onOpenChange} {...rest} /> : null}
    </BottomSheet>
  );
}

function DatePickerBody({
  onOpenChange,
  value,
  onConfirm,
  yearsBefore = 2,
  yearsAfter = 3,
}: Omit<DatePickerSheetProps, "open">) {
  const yearListRef = useRef<HTMLDivElement>(null);
  const monthListRef = useRef<HTMLDivElement>(null);
  const dayListRef = useRef<HTMLDivElement>(null);

  const years = useMemo(() => {
    const currentYear = getSeoulDateParts().year;
    return Array.from(
      { length: yearsBefore + yearsAfter + 1 },
      (_, idx) => currentYear - yearsBefore + idx
    );
  }, [yearsBefore, yearsAfter]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, idx) => idx + 1), []);

  const [draft, setDraft] = useState(() => {
    const base = (value ? parseDateKey(value) : null) ?? getSeoulTodayDate();
    return { year: base.getFullYear(), month: base.getMonth() + 1, day: base.getDate() };
  });

  // 선택된 항목을 각 열의 가운데로 스크롤한다. 없으면 목록이 맨 위에 머물러
  // 지금 값이 선택돼 있는데도 화면 밖이라 보이지 않는다.
  useEffect(() => {
    const scrollToCenter = (container: HTMLDivElement | null, target: string) => {
      if (!container) return;
      const node = container.querySelector<HTMLButtonElement>(`button[data-value="${target}"]`);
      node?.scrollIntoView({ block: "center", inline: "center" });
    };
    const frame = requestAnimationFrame(() => {
      scrollToCenter(yearListRef.current, String(draft.year));
      scrollToCenter(monthListRef.current, String(draft.month).padStart(2, "0"));
      scrollToCenter(dayListRef.current, String(draft.day).padStart(2, "0"));
    });
    return () => cancelAnimationFrame(frame);
  }, [draft.year, draft.month, draft.day]);

  const daysInMonth = new Date(draft.year, draft.month, 0).getDate();

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div
          ref={yearListRef}
          className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2"
        >
          {years.map((year) => (
            <Button
              key={`date-year-${year}`}
              data-value={String(year)}
              type="button"
              variant={draft.year === year ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setDraft((prev) => ({ ...prev, year }))}
            >
              {year}년
            </Button>
          ))}
        </div>
        <div
          ref={monthListRef}
          className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2"
        >
          {months.map((month) => {
            const padded = String(month).padStart(2, "0");
            return (
              <Button
                key={`date-month-${month}`}
                data-value={padded}
                type="button"
                variant={draft.month === month ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setDraft((prev) => ({ ...prev, month }))}
              >
                {padded}월
              </Button>
            );
          })}
        </div>
        <div
          ref={dayListRef}
          className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2"
        >
          {Array.from({ length: daysInMonth }, (_, idx) => idx + 1).map((day) => {
            const padded = String(day).padStart(2, "0");
            const weekday = format(new Date(draft.year, draft.month - 1, day), "EEE", {
              locale: ko,
            });
            return (
              <Button
                key={`date-day-${day}`}
                data-value={padded}
                type="button"
                variant={draft.day === day ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setDraft((prev) => ({ ...prev, day }))}
              >
                {padded}일 ({weekday})
              </Button>
            );
          })}
        </div>
      </div>
      <div className="mt-4">
        <Button
          className="h-12 w-full"
          onClick={() => {
            // 월을 바꾸면서 말일이 줄어드는 경우(예: 3/31 → 2월)를 막는다.
            const safeDay = Math.min(draft.day, daysInMonth);
            const padded = `${draft.year}-${String(draft.month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
            onConfirm(padded);
            onOpenChange(false);
          }}
        >
          적용하기
        </Button>
      </div>
    </>
  );
}
