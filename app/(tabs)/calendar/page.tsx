"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Settings } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import BottomSheet from "@/components/sheets/BottomSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

export default function CalendarPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const [moodAverages, setMoodAverages] = useState<Record<string, number>>({});
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [monthDraft, setMonthDraft] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  }));
  const [weekStartMonday, setWeekStartMonday] = useState(false);
  const [highlightWeekend, setHighlightWeekend] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

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
        .single();

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
  const todayStr = formatDate(new Date());
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
    <main className="flex min-h-[calc(100vh-56px)] flex-col px-0 pb-6 pt-6">
      <header className="mb-4 flex items-center justify-between px-4">
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
          variant="ghost"
          size="icon-lg"
          className="text-[#17171c]/70"
          aria-label="캘린더 설정"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="size-6" />
        </Button>
      </header>

      <section className="grid grid-cols-7 gap-0 pb-2 text-center text-xs text-[#17171c]/60">
        {weekLabels.map((day, index) => {
          const isWeekend =
            index === (weekStartMonday ? 5 : 0) || index === 6;
          const weekendClass = highlightWeekend
            ? index === (weekStartMonday ? 5 : 0)
              ? "text-blue-600"
              : "text-red-500"
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
          const weekendIndex = cell.date
            ? weekStartMonday
              ? (cell.date.getDay() + 6) % 7
              : cell.date.getDay()
            : null;
          const isWeekend =
            weekendIndex === (weekStartMonday ? 5 : 0) || weekendIndex === 6;
          const weekendClass = highlightWeekend
            ? weekendIndex === (weekStartMonday ? 5 : 0)
              ? "text-blue-600"
              : "text-red-500"
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
                      ? "bg-[#ff273d] text-white"
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
                    <img
                      src={`/mood/cat-${moodValue}.svg`}
                      alt={`기분 ${moodValue}단계`}
                      className="h-full w-full max-h-[52px] object-contain"
                    />
                    {count >= 2 ? (
                      <Badge className="absolute -right-1 -top-1 min-w-6 justify-center rounded-full bg-[#17171c] px-1.5 text-[11px] text-white">
                        {count}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {!moodValue && count >= 2 ? (
                <Badge className="absolute right-1 top-1 min-w-5 justify-center rounded-full bg-[#17171c] px-1 text-[10px] text-white">
                  {count}
                </Badge>
              ) : null}
            </Button>
          );
        })}
      </section>
      <BottomSheet
        open={monthSheetOpen}
        onOpenChange={setMonthSheetOpen}
        title="연월을 선택해 주세요"
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
            className="w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
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
      <BottomSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="캘린더 설정"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-black/10 bg-white px-4 py-4">
            <p className="text-sm font-medium text-[#17171c]">
              월요일로 주간 시작
            </p>
            <Switch checked={weekStartMonday} onCheckedChange={setWeekStartMonday} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-black/10 bg-white px-4 py-4">
            <p className="text-sm font-medium text-[#17171c]">주말 색 표시</p>
            <Switch
              checked={highlightWeekend}
              onCheckedChange={setHighlightWeekend}
            />
          </div>
        </div>
      </BottomSheet>
    </main>
  );
}
