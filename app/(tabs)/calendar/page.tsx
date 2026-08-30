"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Clock, MapPin, Plus, Quote, UserRound } from "lucide-react";
import { sendHapticToApp } from "@/lib/reactNativeWebView";

import { useAuth } from "@/components/auth/AuthProvider";
import { useConsentSheet } from "@/components/auth/ConsentSheetProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import CalendarPopupAd from "@/components/ads/CalendarPopupAd";
import AddRecordEntrySheet from "@/components/records/AddRecordEntrySheet";
import BottomSheet from "@/components/sheets/BottomSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatSeoulDateKey,
  getSeoulTodayDate,
} from "@/lib/kstDateTime";
import { getAccessToken } from "@/lib/authSession";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  getCalendarMonthData,
  setCalendarMonthData,
  invalidateCalendarCache,
  getCalendarNavState,
  setCalendarNavState,
} from "@/lib/calendarHomeCache";

function toMinutes(time: string) {
  const [hh, mm, ss] = time.split(":").map(Number);
  return hh * 60 + mm + (ss ? Math.round(ss / 60) : 0);
}

function getWeekendClass(isSaturday: boolean, isSunday: boolean, highlight: boolean): string {
  if (!highlight) return "";
  if (isSaturday) return "text-blue-600";
  if (isSunday) return "text-red-500";
  return "";
}

function getMonthBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

type SelectedRecord = {
  id: string;
  start_time: string;
  end_time: string;
  content: string;
  mood: number | null;
  created_at: string;
  location: string | null;
  instructor: string | null;
  level: string | null;
  status: string;
  recurrence_id: string | null;
};

const parseLocationName = (value: string | null) => {
  if (!value) return "";
  return value.includes(" | ") ? value.split(" | ")[0].trim() : value.trim();
};

const formatInstructorLevel = (record: SelectedRecord) =>
  [record.instructor, record.level].filter(Boolean).join(" · ");

const SWIPE_THRESHOLD_PX = 40;
const SWIPE_TRANSITION_LOCK_MS = 240;

export default function CalendarPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const { ensureConsent } = useConsentSheet();

  const cachedNav = getCalendarNavState();

  const [currentDate, setCurrentDate] = useState(() => {
    if (cachedNav) return new Date(cachedNav.year, cachedNav.month - 1, 1);
    return getSeoulTodayDate();
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialMonthKey = useMemo(() => {
    const d = cachedNav
      ? new Date(cachedNav.year, cachedNav.month - 1, 1)
      : getSeoulTodayDate();
    return `${d.getFullYear()}-${d.getMonth() + 1}`;
  }, []);

  const cachedMonthData = getCalendarMonthData(initialMonthKey);
  const [doneCounts, setDoneCounts] = useState<Record<string, number>>(
    () => cachedMonthData?.doneCounts ?? {}
  );
  const [plannedCounts, setPlannedCounts] = useState<Record<string, number>>(
    () => cachedMonthData?.plannedCounts ?? {}
  );
  const [moodAverages, setMoodAverages] = useState<Record<string, number>>(
    () => cachedMonthData?.moodAverages ?? {}
  );
  const [monthSummary, setMonthSummary] = useState<{ count: number; mins: number; days: number } | null>(
    () => cachedMonthData?.monthSummary ?? null
  );
  const [todayStr, setTodayStr] = useState<string>("");
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const [monthDraft, setMonthDraft] = useState(() => {
    if (cachedNav) return { year: cachedNav.year, month: cachedNav.month };
    const today = getSeoulTodayDate();
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  });
  const [selectedDate, setSelectedDate] = useState<string>(() => cachedNav?.selectedDate ?? "");
  const [selectedDateRecords, setSelectedDateRecords] = useState<SelectedRecord[]>([]);
  const [weekStartMonday, setWeekStartMonday] = useState(false);
  const [highlightWeekend, setHighlightWeekend] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [addRecordSheetOpen, setAddRecordSheetOpen] = useState(false);
  const swipeStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const swipeHandledRef = useRef(false);
  const swipeLockedRef = useRef(false);
  const swipeLockTimeoutRef = useRef<number | null>(null);

  const { start, end } = useMemo(
    () => getMonthBounds(currentDate),
    [currentDate]
  );

  // 내비게이션 상태 캐시 동기화
  useEffect(() => {
    setCalendarNavState({
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1,
      selectedDate,
    });
  }, [currentDate, selectedDate]);

  const fetchCounts = useCallback(async (force = false) => {
    if (!user) {
      setDoneCounts({});
      setPlannedCounts({});
      setMoodAverages({});
      return;
    }

    const monthKey = `${start.getFullYear()}-${start.getMonth() + 1}`;

    // 캐시 가드: force=true(record-changed 시그널)가 아니고 캐시 있으면 state 복원 후 생략
    const cachedMonthData = getCalendarMonthData(monthKey);
    if (!force && cachedMonthData) {
      setDoneCounts(cachedMonthData.doneCounts);
      setPlannedCounts(cachedMonthData.plannedCounts);
      setMoodAverages(cachedMonthData.moodAverages);
      setMonthSummary(cachedMonthData.monthSummary ?? null);
      return;
    }

    // M4: 캘린더 셀 표시(예정 포함)와 통계/mood평균(done만)을 별도 쿼리로 분리(§6.5 #26·#27).
    const [displayRes, statsRes] = await Promise.all([
      // 표시용 — 날짜별 예정/완료를 구분해 보여주는 게 기능 목적이라 status를 select만 하고 필터는 걸지 않음(§9.1, §9.2, §9.7)
      supabase
        .from("records")
        .select("record_date,status")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .gte("record_date", formatSeoulDateKey(start))
        .lte("record_date", formatSeoulDateKey(end)),
      // 통계용 — mood 평균·월 요약은 D1에 따라 완료(done)만 집계
      supabase
        .from("records")
        .select("record_date,mood,start_time,end_time")
        .eq("user_id", user.id)
        .eq("status", "done")
        .is("deleted_at", null)
        .gte("record_date", formatSeoulDateKey(start))
        .lte("record_date", formatSeoulDateKey(end)),
    ]);

    if (displayRes.error || !displayRes.data || statsRes.error || !statsRes.data) {
      return;
    }

    const displayData = displayRes.data;
    const statsData = statsRes.data;

    if (!force && displayData.length === 0 && statsData.length === 0) {
      setDoneCounts({});
      setPlannedCounts({});
      setMoodAverages({});
      setMonthSummary(null);
      return;
    }

    // 완료/예정을 별도 맵으로 집계 — 완료 채움 배지와 예정 outline 배지가 서로 다른 카운트를 쓴다(§9.7).
    const doneCountMap: Record<string, number> = {};
    const plannedCountMap: Record<string, number> = {};
    displayData.forEach((record) => {
      if (record.status === "planned") {
        plannedCountMap[record.record_date] = (plannedCountMap[record.record_date] ?? 0) + 1;
      } else {
        doneCountMap[record.record_date] = (doneCountMap[record.record_date] ?? 0) + 1;
      }
    });

    const moodTotals: Record<string, number> = {};
    const moodCounts: Record<string, number> = {};
    let totalMins = 0;
    statsData.forEach((record) => {
      if (record.mood) {
        moodTotals[record.record_date] =
          (moodTotals[record.record_date] ?? 0) + record.mood;
        moodCounts[record.record_date] =
          (moodCounts[record.record_date] ?? 0) + 1;
      }
      totalMins += toMinutes(record.end_time) - toMinutes(record.start_time);
    });
    const averages: Record<string, number> = {};
    Object.keys(moodTotals).forEach((date) => {
      const avg = moodTotals[date] / (moodCounts[date] ?? 1);
      const rounded = Math.round(avg);
      averages[date] = Math.min(8, Math.max(1, rounded));
    });

    const days = new Set(statsData.map((r) => r.record_date)).size;
    const summary = statsData.length > 0 ? { count: statsData.length, mins: totalMins, days } : null;
    setCalendarMonthData(monthKey, {
      doneCounts: doneCountMap,
      plannedCounts: plannedCountMap,
      moodAverages: averages,
      monthSummary: summary,
    });
    setDoneCounts(doneCountMap);
    setPlannedCounts(plannedCountMap);
    setMoodAverages(averages);
    setMonthSummary(summary);
  }, [user, start, end]);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setWeekStartMonday(false);
      setHighlightWeekend(false);
      setSettingsLoaded(true);
      return;
    }

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
    }
    setSettingsLoaded(true);
  }, [user]);

  const fetchRecordsForDate = useCallback(async (date: string) => {
    if (!user || !date) {
      setSelectedDateRecords([]);
      return;
    }
    // 표시 목적(선택 날짜 기록 나열) — status 필터 없음. select에 status·recurrence_id 포함(G2)
    const { data } = await supabase
      .from("records")
      .select("id, start_time, end_time, content, mood, created_at, location, instructor, level, status, recurrence_id")
      .eq("user_id", user.id)
      .eq("record_date", date)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setSelectedDateRecords((data as SelectedRecord[]) ?? []);
  }, [user]);

  useEffect(() => {
    fetchRecordsForDate(selectedDate);
  }, [selectedDate, fetchRecordsForDate]);

  useEffect(() => {
    const handleRefresh = () => {
      const changedKeys = Object.keys(sessionStorage).filter(k =>
        k.startsWith("record-changed:")
      );
      if (changedKeys.length === 0) return;
      changedKeys.forEach(k => sessionStorage.removeItem(k));
      invalidateCalendarCache();
      void fetchCounts(true);
      if (selectedDate) {
        fetchRecordsForDate(selectedDate);
      }
    };
    window.addEventListener("pageshow", handleRefresh);
    window.addEventListener("popstate", handleRefresh);
    return () => {
      window.removeEventListener("pageshow", handleRefresh);
      window.removeEventListener("popstate", handleRefresh);
    };
  }, [selectedDate, fetchRecordsForDate, fetchCounts]);

  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user) {
      prevUserIdRef.current = null;
      setDoneCounts({});
      setPlannedCounts({});
      setMoodAverages({});
      setWeekStartMonday(false);
      setHighlightWeekend(false);
      setSettingsLoaded(true);
      return;
    }
    const pendingKeys = Object.keys(sessionStorage).filter(k => k.startsWith("record-changed:"));
    const force = pendingKeys.length > 0;
    if (force) {
      pendingKeys.forEach(k => sessionStorage.removeItem(k));
      invalidateCalendarCache();
    }

    const userChanged = prevUserIdRef.current !== user.id;
    prevUserIdRef.current = user.id;
    if (userChanged) {
      void Promise.all([fetchCounts(force), fetchSettings()]);
    } else {
      void fetchCounts(force);
    }
  }, [user, start, end, fetchCounts, fetchSettings]);

  const isInitialSettingsLoad = useRef(true);
  useEffect(() => {
    if (!settingsLoaded || !user) return;
    if (isInitialSettingsLoad.current) {
      isInitialSettingsLoad.current = false;
      return;
    }
    const persistSettings = async () => {
      const token = await getAccessToken(openLoginSheet);
      if (!token) return;
      try {
        const res = await fetch("/api/profile/calendar-settings", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            calendar_week_start_monday: weekStartMonday,
            calendar_highlight_weekend: highlightWeekend,
          }),
        });
        if (!res.ok) {
          toast("캘린더 설정 저장에 실패했어요.");
        }
      } catch {
        // 네트워크 오류 무시 (다음 접속 시 재저장됨)
      }
    };
    void persistSettings();
  }, [weekStartMonday, highlightWeekend, user, settingsLoaded, openLoginSheet]);

  useEffect(() => {
    const update = () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setTodayStr(formatSeoulDateKey());
    };
    update();
    const handler = () => {
      if (document.visibilityState !== "visible") return;
      const today = getSeoulTodayDate();
      setCurrentDate(today);
      setMonthDraft({ year: today.getFullYear(), month: today.getMonth() + 1 });
      setSelectedDate("");
      update();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const monthLabel = `${currentDate.getFullYear()}년 ${
    currentDate.getMonth() + 1
  }월`;
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
    setSelectedDate("");
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
      const startPoint = swipeStartPointRef.current;
      swipeStartPointRef.current = null;
      if (!startPoint) return;

      const point = event.changedTouches[0];
      if (!point) return;

      const deltaX = point.clientX - startPoint.x;
      const deltaY = point.clientY - startPoint.y;
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

  const handleAddRecord = useCallback(() => {
    if (!user) {
      openLoginSheet();
      return;
    }
    setAddRecordSheetOpen(true);
  }, [user, openLoginSheet]);

  const handleSelectTodayRecord = useCallback(async () => {
    const consentOk = await ensureConsent();
    if (!consentOk) return;
    router.push(selectedDate ? `/record/new?date=${selectedDate}` : "/record/new");
  }, [ensureConsent, router, selectedDate]);

  const handleSelectRecurringRecord = useCallback(async () => {
    const consentOk = await ensureConsent();
    if (!consentOk) return;
    router.push("/record/recurring/new");
  }, [ensureConsent, router]);

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

    const rowCount = Math.ceil((firstDay + daysInMonth) / 7);
    const totalCells = rowCount * 7;
    const result: Array<{ date: Date | null; day: number | null }> = [];
    for (let i = 0; i < totalCells; i += 1) {
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
    <>
      <main className="flex min-h-[calc(100vh-56px)] flex-col px-0 pb-[140px]">
        <header className="sticky top-0 z-20 bg-background h-12 flex items-center justify-between px-4">
        <div className="flex items-center gap-0">
          <p className="text-lg font-bold">{monthLabel}</p>
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
          className="h-10 w-10 rounded-xl bg-primary text-primary-foreground"
          aria-label="기록 생성"
          onClick={handleAddRecord}
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
        {monthSummary && (
          <p className="mx-2 mt-3 mb-2 px-3 py-2 text-sm text-[#17171c]/60 bg-brand/8 rounded-xl">
            이번 달에는{" "}
            <span className="font-semibold text-[#17171c]">{monthSummary.count}번</span>{" "}
            기록하고{" "}
            <span className="font-semibold text-[#17171c]">
              {monthSummary.mins >= 60
                ? `${Math.floor(monthSummary.mins / 60)}시간${monthSummary.mins % 60 > 0 ? ` ${monthSummary.mins % 60}분` : ""}`
                : `${monthSummary.mins}분`}
            </span>을 쌓았어요🩰
          </p>
        )}
        <section className={`grid grid-cols-7 gap-0 pb-2 px-1 text-center text-sm text-[#17171c]/60 ${!monthSummary ? "pt-4" : ""}`}>
          {weekLabels.map((day) => {
            const isSaturday = day === "토";
            const isSunday = day === "일";
            const weekendClass = getWeekendClass(isSaturday, isSunday, highlightWeekend);
            return (
              <span
                key={day}
                className={`flex items-center justify-center py-1 ${weekendClass}`}
              >
                {day}
              </span>
            );
          })}
        </section>
        <div className="h-px bg-[#17171c]/5 mx-1" />

        <section className="grid flex-1 grid-cols-7 gap-0 auto-rows-fr px-1 mt-1">
          {cells.map((cell, index) => {
            const isEmpty = !cell.date;
            const dateStr = cell.date ? formatSeoulDateKey(cell.date) : "";
            const doneCount = doneCounts[dateStr] ?? 0;
            const plannedCount = plannedCounts[dateStr] ?? 0;
            const hasPlanned = plannedCount > 0;
            const hasDone = doneCount > 0;
            const moodValue = moodAverages[dateStr];
            const isToday = !!dateStr && dateStr === todayStr;
            const isPastDate = !!dateStr && dateStr < todayStr;
            const dayOfWeek = cell.date ? cell.date.getDay() : null;
            const isSaturday = dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;
            const weekendClass = getWeekendClass(isSaturday, isSunday, highlightWeekend);

            const isSelected = !!dateStr && dateStr === selectedDate;

            return (
              <div
                key={`${index}-${dateStr}`}
                className={`relative flex h-full min-h-20 flex-col overflow-visible ${
                  isEmpty ? "opacity-40" : ""
                } ${isSelected ? "bg-[#17171c]/5 rounded-md" : ""}`}
              >
                {/* 상단: 날짜 숫자 → 기록 리스트 인라인 표시 */}
                <button
                  type="button"
                  disabled={isEmpty}
                  className="flex w-full items-start justify-center pt-1"
                  onClick={() => {
                    if (!cell.date) return;
                    sendHapticToApp();
                    const next = dateStr === selectedDate ? "" : dateStr;
                    setSelectedDate(next);
                  }}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      isToday
                        ? "bg-[#17171c] text-white"
                        : weekendClass || "text-[#17171c]"
                    }`}
                  >
                    {cell.day ?? ""}
                  </span>
                </button>

                {/* 하단: 무드(고양이) 영역 → 기록 리스트 인라인 표시 */}
                <button
                  type="button"
                  disabled={isEmpty}
                  className="flex h-[52px] w-full shrink-0 items-center justify-center overflow-visible pt-1"
                  onClick={() => {
                    if (!cell.date) return;
                    sendHapticToApp();
                    const next = dateStr === selectedDate ? "" : dateStr;
                    setSelectedDate(next);
                  }}
                >
                  {moodValue ? (
                    <div className="relative h-full w-full overflow-visible">
                      <AnimatedImage
                        src={`/mood/mood_dark_face_${moodValue}.png`}
                        alt={`기분 ${moodValue}단계`}
                        width={1600}
                        height={1600}
                        unoptimized
                        draggable={false}
                        className="h-full w-full max-h-[52px] object-contain"
                        loading="eager"
                      />
                      {doneCount >= 2 ? (
                        <Badge className="absolute right-0.5 -top-1 min-w-6 justify-center rounded-full bg-primary px-1.5 text-xs text-white">
                          {doneCount}
                        </Badge>
                      ) : null}
                      {hasPlanned ? (
                        // 혼합(완료+예정) — 완료 배지가 이미 코너를 차지해 outline 배지를 더 넣을 여백이 없는
                        // 압축 위치라 6px 저투명 도트로만 "예정도 있음"을 보조 표기한다(design.md 작은 도트 규칙)
                        <span
                          aria-hidden
                          className="absolute -top-1 left-0.5 size-1.5 rounded-full bg-[#17171c]/30"
                        />
                      ) : null}
                    </div>
                  ) : hasDone ? (
                    // 완료(감정 없음) — "감정 없이 완료"한 기록은 무드 얼굴이 없으므로 채운 원으로 완료를
                    // 표기한다(예정의 점선 원과 대비). 개수(2건 이상)는 셀 우상단 배지에서 별도 표기.
                    <div className="relative flex h-full w-full items-center justify-center overflow-visible">
                      <div
                        aria-hidden
                        className="h-10 w-10 rounded-full bg-[#17171c]/10"
                      />
                      {hasPlanned ? (
                        <span
                          aria-hidden
                          className="absolute -top-1 left-0.5 size-1.5 rounded-full bg-[#17171c]/30"
                        />
                      ) : null}
                    </div>
                  ) : hasPlanned ? (
                    // 예정만(완료 mood 없음) — 무드 이미지 자리에 점선 원으로 대체(design.md 무드 슬롯 표현)
                    <div className="relative flex h-full w-full items-center justify-center overflow-visible">
                      <div
                        aria-hidden
                        className={`h-10 w-10 rounded-full border-2 border-dashed ${
                          isPastDate ? "border-[#17171c]/20" : "border-[#17171c]/40"
                        }`}
                      />
                      {plannedCount >= 2 ? (
                        <Badge
                          variant="outline"
                          className="absolute right-0.5 -top-1 min-w-6 justify-center rounded-full border-[#17171c]/30 bg-background px-1.5 text-xs text-[#17171c]/70"
                        >
                          {plannedCount}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </button>

                {!moodValue && doneCount >= 2 ? (
                  <Badge className="absolute right-2 top-1 min-w-5 justify-center rounded-full bg-primary px-1 text-xs text-white pointer-events-none">
                    {doneCount}
                  </Badge>
                ) : null}
              </div>
            );
          })}
        </section>

        {selectedDateRecords.length > 0 && (
          <section className="mt-2 divide-y divide-[#17171c]/5 border-t border-[#17171c]/5">
            {selectedDateRecords.map((record) => {
              const isPlanned = record.status === "planned";
              const isPastSelectedDate = !!selectedDate && selectedDate < todayStr;
              return (
              <button
                key={record.id}
                type="button"
                onClick={() => { sendHapticToApp(); router.push(`/record/${record.id}`); }}
                className="flex w-full items-center gap-3 px-4 py-4 text-left"
              >
                {record.mood ? (
                  <AnimatedImage
                    src={`/mood/mood_dark_face_${record.mood}.png`}
                    alt="기분"
                    width={1600}
                    height={1600}
                    unoptimized
                    draggable={false}
                    className="h-12 w-12 shrink-0 object-contain"
                  />
                ) : isPlanned ? (
                  <div
                    aria-hidden
                    className={`h-12 w-12 shrink-0 rounded-full border-2 border-dashed ${
                      isPastSelectedDate ? "border-[#17171c]/20" : "border-[#17171c]/40"
                    }`}
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-full bg-[#17171c]/5" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex items-center gap-1 text-sm text-[#17171c]">
                    <Clock className="h-3 w-3 shrink-0" />
                    {record.start_time.slice(0, 5)} ~ {record.end_time.slice(0, 5)}
                    {isPlanned && (
                      <Badge
                        variant="outline"
                        className="ml-1 border-[#17171c]/30 bg-background px-1.5 py-0 text-[10px] text-[#17171c]/70"
                      >
                        예정
                      </Badge>
                    )}
                  </p>
                  {record.content && (
                    <p className="flex items-start gap-1 truncate text-xs text-[#17171c]">
                      <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {record.content}
                    </p>
                  )}
                  {(parseLocationName(record.location) || formatInstructorLevel(record)) && (
                    <p className="flex items-center gap-1.5 text-xs text-[#17171c]">
                      {parseLocationName(record.location) && (
                        <>
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{parseLocationName(record.location)}</span>
                        </>
                      )}
                      {formatInstructorLevel(record) && (
                        <>
                          <UserRound className="h-3 w-3 shrink-0" />
                          <span className="truncate">{formatInstructorLevel(record)}</span>
                        </>
                      )}
                    </p>
                  )}
                </div>
                <ChevronRight className="size-5 shrink-0 text-[#17171c]/30" />
              </button>
              );
            })}
          </section>
        )}
      </div>

        <BottomSheet
          open={monthSheetOpen}
          onOpenChange={setMonthSheetOpen}
        >
        <div className="grid grid-cols-2 gap-3">
          <div className="no-scrollbar max-h-56 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2">
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
          <div className="no-scrollbar max-h-56 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2">
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
            className="h-12 w-full"
            onClick={() => {
              setCurrentDate(
                new Date(monthDraft.year, monthDraft.month - 1, 1)
              );
              setSelectedDate("");
              setMonthSheetOpen(false);
            }}
          >
            적용하기
          </Button>
        </div>
        </BottomSheet>
        <AddRecordEntrySheet
          open={addRecordSheetOpen}
          onOpenChange={setAddRecordSheetOpen}
          onSelectToday={handleSelectTodayRecord}
          onSelectRecurring={handleSelectRecurringRecord}
        />
      </main>
      <CalendarPopupAd />
    </>
  );
}
