"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";

import BottomSheet from "@/components/sheets/BottomSheet";
import { Button } from "@/components/ui/button";
import { getHour12, getMeridiemLabel } from "@/lib/kstDateTime";

type Meridiem = "AM" | "PM";

type TimeDraft = {
  meridiem: Meridiem;
  hour12: number;
  minute: string;
};

type TimePickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "HH:MM"(24시간) 형식. 빈 문자열이면 값이 아직 없는 상태다. */
  value: string;
  /** 적용하기를 누르면 "HH:MM"(24시간, 2자리 zero-pad)으로 전달된다. */
  onConfirm: (value: string) => void;
  title?: string;
};

const HOURS_12 = Array.from({ length: 12 }, (_, idx) => idx + 1);
const MINUTES = Array.from({ length: 60 }, (_, idx) => String(idx).padStart(2, "0"));
const DEFAULT_DRAFT: TimeDraft = { meridiem: "AM", hour12: 12, minute: "00" };

const parseTimeValue = (value: string): TimeDraft | null => {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hourValue = Number(match[1]);
  const minuteValue = match[2];
  if (Number.isNaN(hourValue) || hourValue < 0 || hourValue > 23) return null;
  return {
    meridiem: getMeridiemLabel(hourValue) === "오전" ? "AM" : "PM",
    hour12: getHour12(hourValue),
    minute: minuteValue,
  };
};

/**
 * 12시간(meridiem + 1~12시) 드래프트를 24시간 "HH:MM"(2자리 zero-pad) 문자열로 변환한다.
 * 저장 포맷은 항상 24시간이며, 클라 문자열 비교(end_time <= start_time)가 깨지지 않도록
 * 시(hour)는 반드시 2자리로 맞춘다.
 * - 오전 12시 → "00"
 * - 오전 1~11시 → "01"~"11"
 * - 오후 12시 → "12"
 * - 오후 1~11시 → "13"~"23"
 */
const toTimeValue = (draft: TimeDraft): string => {
  let hour24: number;
  if (draft.meridiem === "AM") {
    hour24 = draft.hour12 === 12 ? 0 : draft.hour12;
  } else {
    hour24 = draft.hour12 === 12 ? 12 : draft.hour12 + 12;
  }
  return `${String(hour24).padStart(2, "0")}:${draft.minute}`;
};

export default function TimePickerSheet({
  open,
  onOpenChange,
  value,
  onConfirm,
  title,
}: TimePickerSheetProps) {
  const [draft, setDraft] = useState<TimeDraft>(DEFAULT_DRAFT);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(parseTimeValue(value) ?? DEFAULT_DRAFT);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const hourTarget = hourListRef.current?.querySelector(
        `[data-value="${draft.hour12}"]`
      );
      const minuteTarget = minuteListRef.current?.querySelector(
        `[data-value="${draft.minute}"]`
      );
      hourTarget?.scrollIntoView({ block: "center" });
      minuteTarget?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, draft.hour12, draft.minute]);

  const handleConfirm = () => {
    onConfirm(toTimeValue(draft));
    onOpenChange(false);
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <div className="flex h-48 flex-col justify-center gap-1 rounded-md border border-[#17171c]/5 p-2">
          <Button
            type="button"
            variant={draft.meridiem === "AM" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setDraft((prev) => ({ ...prev, meridiem: "AM" }))}
          >
            오전
          </Button>
          <Button
            type="button"
            variant={draft.meridiem === "PM" ? "default" : "ghost"}
            className="w-full justify-start"
            onClick={() => setDraft((prev) => ({ ...prev, meridiem: "PM" }))}
          >
            오후
          </Button>
        </div>
        <div
          ref={hourListRef}
          className="no-scrollbar h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2"
        >
          {HOURS_12.map((hour) => (
            <Button
              key={`time-picker-hour-${hour}`}
              type="button"
              data-value={hour}
              variant={draft.hour12 === hour ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setDraft((prev) => ({ ...prev, hour12: hour }))}
            >
              {hour}시
            </Button>
          ))}
        </div>
        <div
          ref={minuteListRef}
          className="no-scrollbar h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2"
        >
          {MINUTES.map((minute) => (
            <Button
              key={`time-picker-minute-${minute}`}
              type="button"
              data-value={minute}
              variant={draft.minute === minute ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setDraft((prev) => ({ ...prev, minute }))}
            >
              {minute}분
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <Button type="button" className="h-12 w-full" onClick={handleConfirm}>
          적용하기
        </Button>
      </div>
    </BottomSheet>
  );
}
