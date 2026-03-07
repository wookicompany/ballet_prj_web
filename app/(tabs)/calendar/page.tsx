"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useConsentSheet } from "@/components/auth/ConsentSheetProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import BottomSheet from "@/components/sheets/BottomSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatSeoulDateKey,
  getSeoulTodayDate,
} from "@/lib/kstDateTime";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

const SWIPE_THRESHOLD_PX = 40;
const SWIPE_TRANSITION_LOCK_MS = 240;

export default function CalendarPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const { ensureConsent } = useConsentSheet();
  const [currentDate, setCurrentDate] = useState(() => getSeoulTodayDate());
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const [moodAverages, setMoodAverages] = useState<Record<string, number>>({});
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const [monthDraft, setMonthDraft] = useState(() => {
    const today = getSeoulTodayDate();
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    };
  });
  const [weekStartMonday, setWeekStartMonday] = useState(false);
  const [highlightWeekend, setHighlightWeekend] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const swipeStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const swipeHandledRef = useRef(false);
  const swipeLockedRef = useRef(false);
  const swipeLockTimeoutRef = useRef<number | null>(null);

  const { start, end } = useMemo(
    () => getMonthBounds(currentDate),
    [currentDate]
  );

  useEffect(() => {
    const fetchCounts = async () => {
      if (!user) {
        setRecordCounts({});
        setMoodAverages({});
        return;
      }

      const { data, error } = await supabase
        .from("records")
        .select("record_date,mood")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .gte("record_date", formatDate(start))
        .lte("record_date", formatDate(end));

      if (error || !data) {
        setRecordCounts({});
        setMoodAverages({});
        return;
      }

      const counts: Record<string, number> = {};
      const moodTotals: Record<string, number> = {};
      const moodCounts: Record<string, number> = {};
      data.forEach((record) => {
        counts[record.record_date] = (counts[record.record_date] ?? 0) + 1;
        if (record.mood) {
          moodTotals[record.record_date] =
            (moodTotals[record.record_date] ?? 0) + record.mood;
          moodCounts[record.record_date] =
            (moodCounts[record.record_date] ?? 0) + 1;
        }
      });
      setRecordCounts(counts);
      const averages: Record<string, number> = {};
      Object.keys(moodTotals).forEach((date) => {
        const avg = moodTotals[date] / (moodCounts[date] ?? 1);
        const rounded = Math.round(avg);
        averages[date] = Math.min(5, Math.max(1, rounded));
      });
      setMoodAverages(averages);
    };

    fetchCounts();
  }, [user, start, end]);

  useEffect(() => {
    if (!user) {
      setWeekStartMonday(false);
      setHighlightWeekend(false);
      setSettingsLoaded(true);
      return;
    }

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("calendar_week_start_monday,calendar_highlight_weekend")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setWeekStartMonday(false);
        setHighlightWeekend(false);
        setSettingsLoaded(true);
        return;
      }

      if (data) {
        setWeekStartMonday(!!data.calendar_week_start_monday);
        setHighlightWeekend(!!data.calendar_highlight_weekend);
      } else {
        setWeekStartMonday(false);
        setHighlightWeekend(false);
        await supabase.from("profiles").upsert({
          id: user.id,
          calendar_week_start_monday: false,
          calendar_highlight_weekend: false,
        });
      }
      setSettingsLoaded(true);
    };

    fetchSettings();
  }, [user]);

  useEffect(() => {
    if (!settingsLoaded || !user) return;
    const persistSettings = async () => {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        calendar_week_start_monday: weekStartMonday,
        calendar_highlight_weekend: highlightWeekend,
      });
      if (error) {
        toast("캘린더 설정 저장에 실패했습니다.");
      }
    };
    void persistSettings();
  }, [weekStartMonday, highlightWeekend, user, settingsLoaded]);

  const monthLabel = `${currentDate.getFullYear()}년 ${
    currentDate.getMonth() + 1
  }월`;
  const todayStr = formatSeoulDateKey();
  const yearOptions = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    const startYear = 2025;
    const endYear = currentYear + 5;
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => {
      return startYear + index;
    });
  }, [currentDate]);
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    []
  );
  const yearButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const monthButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const changeMonthBy = useCallback((delta: -1 | 1) => {
    if (swipeLockedRef.current) return;
    swipeLockedRef.current = true;
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    if (swipeLockTimeoutRef.current) {
      window.clearTimeout(swipeLockTimeoutRef.current);
    }
    swipeLockTimeoutRef.current = window.setTimeout(() => {
      swipeLockedRef.current = false;
      swipeLockTimeoutRef.current = null;
    }, SWIPE_TRANSITION_LOCK_MS);
  }, []);

  const handleCalendarTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (swipeLockedRef.current) return;
      const point = event.touches[0];
      if (!point) return;
      swipeStartPointRef.current = { x: point.clientX, y: point.clientY };
      swipeHandledRef.current = false;
    },
    []
  );

  const handleCalendarTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (swipeLockedRef.current || swipeHandledRef.current) {
        swipeStartPointRef.current = null;
        return;
      }
      const start = swipeStartPointRef.current;
      swipeStartPointRef.current = null;
      if (!start) return;

      const point = event.changedTouches[0];
      if (!point) return;

      const deltaX = point.clientX - start.x;
      const deltaY = point.clientY - start.y;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

      swipeHandledRef.current = true;
      changeMonthBy(deltaX < 0 ? 1 : -1);
    },
    [changeMonthBy]
  );

  const handleCalendarTouchCancel = useCallback(() => {
    swipeStartPointRef.current = null;
    swipeHandledRef.current = false;
  }, []);

  useEffect(() => {
    if (!monthSheetOpen) return;

    const handleScroll = () => {
      yearButtonRefs.current[monthDraft.year]?.scrollIntoView({
        block: "center",
      });
      monthButtonRefs.current[monthDraft.month]?.scrollIntoView({
        block: "center",
      });
    };

    const frame = window.setTimeout(handleScroll, 0);
    return () => window.clearTimeout(frame);
  }, [monthSheetOpen, monthDraft.year, monthDraft.month]);

  useEffect(
    () => () => {
      if (swipeLockTimeoutRef.current) {
        window.clearTimeout(swipeLockTimeoutRef.current);
      }
    },
    []
  );

  const weekLabels = useMemo(() => {
    return weekStartMonday
      ? ["월", "화", "수", "목", "금", "토", "일"]
      : ["일", "월", "화", "수", "목", "금", "토"];
  }, [weekStartMonday]);

  const cells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDay = new Date(year, month, 1).getDay();
    const firstDay = weekStartMonday ? (startDay + 6) % 7 : startDay;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const result: Array<{ date: Date | null; day: number | null }> = [];
    for (let i = 0; i < 42; i += 1) {
      const dayNumber = i - firstDay + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        result.push({ date: null, day: null });
      } else {
        result.push({
          date: new Date(year, month, dayNumber),
          day: dayNumber,
        });
      }
    }
    return result;
  }, [currentDate, weekStartMonday]);

  return (
    <main className="flex min-h-[calc(100vh-56px)] flex-col px-0 pb-6 pt-2">
      <header className="mb-6 flex items-center justify-between px-4">
        <div className="flex items-center gap-0">
          <p className="text-xl font-semibold">{monthLabel}</p>
          <Button
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            aria-label="연월 선택"
            onClick={() => {
              setMonthDraft({
                year: currentDate.getFullYear(),
                month: currentDate.getMonth() + 1,
              });
              setMonthSheetOpen(true);
            }}
          >
            <ChevronDown className="size-6" strokeWidth={2.5} />
          </Button>
        </div>
        <Button
          type="button"
          variant="default"
          size="icon-lg"
          className="h-10 w-10 rounded-xl bg-[#17171c] text-white hover:bg-[#17171c]/90"
          aria-label="기록 생성"
          onClick={async () => {
            if (!user) {
              openLoginSheet();
              return;
            }
            const consentOk = await ensureConsent();
            if (!consentOk) return;
            router.push("/record/new");
          }}
        >
          <Plus className="size-5" strokeWidth={2.8} />
        </Button>
      </header>

      <div
        className="touch-pan-y"
        onTouchStart={handleCalendarTouchStart}
        onTouchEnd={handleCalendarTouchEnd}
        onTouchCancel={handleCalendarTouchCancel}
      >
        <section className="grid grid-cols-7 gap-0 pb-2 text-center text-sm text-[#17171c]/60">
          {weekLabels.map((day) => {
            const isSaturday = day === "토";
            const isSunday = day === "일";
            const isWeekend = isSaturday || isSunday;
            const weekendClass = highlightWeekend
              ? isSaturday
                ? "text-blue-600"
                : isSunday
                  ? "text-red-500"
                  : ""
              : "";
            return (
              <span
                key={day}
                className={`flex items-center justify-center py-1 ${highlightWeekend && isWeekend ? weekendClass : ""}`}
              >
                {day}
              </span>
            );
          })}
        </section>
        <div className="h-px w-full bg-black/5" />

        <section className="grid flex-1 grid-cols-7 gap-0 auto-rows-fr">
          {cells.map((cell, index) => {
            const isEmpty = !cell.date;
            const dateStr = cell.date ? formatDate(cell.date) : "";
            const count = recordCounts[dateStr] ?? 0;
            const moodValue = moodAverages[dateStr];
            const isToday = dateStr === todayStr;
            const dayOfWeek = cell.date ? cell.date.getDay() : null;
            const isSaturday = dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;
            const isWeekend = isSaturday || isSunday;
            const weekendClass = highlightWeekend
              ? isSaturday
                ? "text-blue-600"
                : isSunday
                  ? "text-red-500"
                  : ""
              : "";

            return (
              <Button
                key={`${index}-${dateStr}`}
                type="button"
                variant="outline"
                className={`relative flex h-full min-h-20 flex-col items-center justify-start gap-2 rounded-none border-none bg-white p-1 text-sm hover:bg-black/5 overflow-visible ${
                  isEmpty ? "opacity-40" : ""
                }`}
                disabled={isEmpty}
                onClick={() => {
                  if (!cell.date) return;
                  router.push(`/day/${dateStr}`);
                }}
              >
                <div className="flex w-full items-start justify-center">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      isToday
                        ? "bg-brand text-white"
                        : highlightWeekend && isWeekend
                          ? weekendClass
                          : "text-[#17171c]"
                    }`}
                  >
                    {cell.day ?? ""}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-center overflow-visible pt-1">
                  {moodValue ? (
                    <div className="relative h-full w-full overflow-visible">
                      <AnimatedImage
                        src={`/mood/cat-${moodValue}.svg`}
                        alt={`기분 ${moodValue}단계`}
                        width={1600}
                        height={1600}
                        unoptimized
                        draggable={false}
                        className="h-full w-full max-h-[52px] object-contain"
                        loading="eager"
                      />
                      {count >= 2 ? (
                        <Badge className="absolute -right-1 -top-1 min-w-6 justify-center rounded-full bg-[#17171c] px-1.5 text-xs text-white">
                          {count}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {!moodValue && count >= 2 ? (
                  <Badge className="absolute right-1 top-1 min-w-5 justify-center rounded-full bg-[#17171c] px-1 text-xs text-white">
                    {count}
                  </Badge>
                ) : null}
              </Button>
            );
          })}
        </section>
      </div>
      <BottomSheet
        open={monthSheetOpen}
        onOpenChange={setMonthSheetOpen}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="no-scrollbar max-h-56 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
            {yearOptions.map((year) => (
              <Button
                key={`calendar-year-${year}`}
                ref={(node) => {
                  yearButtonRefs.current[year] = node;
                }}
                type="button"
                variant={monthDraft.year === year ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() =>
                  setMonthDraft((prev) => ({
                    ...prev,
                    year,
                  }))
                }
              >
                {year}년
              </Button>
            ))}
          </div>
          <div className="no-scrollbar max-h-56 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
            {monthOptions.map((month) => (
              <Button
                key={`calendar-month-${month}`}
                ref={(node) => {
                  monthButtonRefs.current[month] = node;
                }}
                type="button"
                variant={monthDraft.month === month ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() =>
                  setMonthDraft((prev) => ({
                    ...prev,
                    month,
                  }))
                }
              >
                {String(month).padStart(2, "0")}월
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <Button
            className="h-12 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
            onClick={() => {
              setCurrentDate(
                new Date(monthDraft.year, monthDraft.month - 1, 1)
              );
              setMonthSheetOpen(false);
            }}
          >
            적용하기
          </Button>
        </div>
      </BottomSheet>
    </main>
  );
}
