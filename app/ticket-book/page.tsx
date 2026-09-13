"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Ticket } from "lucide-react";

import MobileContainer from "@/components/layout/MobileContainer";
import PageHeader from "@/components/layout/PageHeader";
import BottomSheet from "@/components/sheets/BottomSheet";
import AnimatedImage from "@/components/ui/animated-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { formatSeoulDateKey } from "@/lib/kstDateTime";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import {
  consumeTicketChanged,
  getTicketBookMonthData,
  getTicketBookNavState,
  invalidateTicketBookCache,
  setTicketBookMonthData,
  setTicketBookNavState,
  type TicketSummary,
} from "@/lib/ticketBookCache";
import { toast } from "sonner";

const SWIPE_THRESHOLD_PX = 48;
function getMonthBounds(date: Date) {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 0),
  };
}

function getWeekdayClass(index: number, weekStartMonday: boolean, highlight: boolean) {
  if (!highlight) return "";
  // 인덱스는 화면상의 열 번호라, 월요일 시작이면 5=토 6=일이고 일요일 시작이면 0=일 6=토다.
  const isSaturday = weekStartMonday ? index === 5 : index === 6;
  const isSunday = weekStartMonday ? index === 6 : index === 0;
  if (isSaturday) return "text-blue-600";
  if (isSunday) return "text-red-500";
  return "";
}

type TicketRow = {
  id: string;
  watched_on: string;
  custom_title: string | null;
  custom_venue: string | null;
  rating: number | null;
  performance_id: string | null;
  created_at: string;
  kopis_performances: { prfnm: string | null; fcltynm: string | null; poster: string | null } | null;
  performance_ticket_images: { url: string; deleted_at: string | null }[] | null;
};

export default function TicketBookPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const restored = getTicketBookNavState();
  const [currentDate, setCurrentDate] = useState(() =>
    restored ? new Date(restored.year, restored.month - 1, 1) : new Date()
  );
  const [selectedDate, setSelectedDate] = useState(restored?.selectedDate ?? "");
  const [ticketsByDate, setTicketsByDate] = useState<Record<string, TicketSummary[]>>({});

  // 이 달의 데이터를 "실제로 fetch 완료했는가". 캐시가 있다는 이유만으로 올리지 않는다 —
  // 빈 날 탭의 이동 판정이 이 값에 의존하므로, 낙관적으로 올리면 스테일 카운트로
  // 이미 티켓이 있는 날을 빈 날로 오판해 등록 화면으로 튄다(기록 캘린더에서 실제로 났던 버그).
  const [loadedMonthKey, setLoadedMonthKey] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [weekStartMonday, setWeekStartMonday] = useState(false);
  const [highlightWeekend, setHighlightWeekend] = useState(false);
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const [monthDraft, setMonthDraft] = useState({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
  });

  const yearButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const monthButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const navigatingRef = useRef(false);
  const swipeStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const swipeHandledRef = useRef(false);

  const { start, end } = useMemo(() => getMonthBounds(currentDate), [currentDate]);
  const currentMonthKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`;
  const todayStr = formatSeoulDateKey();

  useEffect(() => {
    setTicketBookNavState({
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1,
      selectedDate,
    });
  }, [currentDate, selectedDate]);

  const fetchTickets = useCallback(
    async (force = false) => {
      if (!user) {
        setTicketsByDate({});
        setLoadedMonthKey(null);
        setFetching(false);
        return;
      }

      const monthKey = `${start.getFullYear()}-${start.getMonth() + 1}`;

      // 재조회가 도는 동안에는 "미로드"로 낮춘다. 스테일 데이터로 빈 날을 오판해
      // 등록 화면으로 잘못 이동하는 것을 막고, 그동안의 탭은 선택 토글로 폴백시킨다.
      if (force) setLoadedMonthKey(null);

      const cached = force ? null : getTicketBookMonthData(monthKey);
      if (cached) {
        setTicketsByDate(cached.ticketsByDate);
        setLoadedMonthKey(monthKey);
        setFetching(false);
        return;
      }

      setFetching(true);
      // 왕복 1회 — PostgREST 임베디드 조인. 관계 해석은 스모크 테스트로 확인했다.
      const { data, error } = await supabase
        .from("performance_tickets")
        .select(
          "id, watched_on, custom_title, custom_venue, rating, performance_id, created_at, kopis_performances(prfnm, fcltynm, poster), performance_ticket_images(url, deleted_at)"
        )
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .gte("watched_on", formatSeoulDateKey(start))
        .lte("watched_on", formatSeoulDateKey(end))
        .order("created_at", { ascending: true });

      if (error || !data) {
        toast("티켓 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setFetching(false);
        return; // loadedMonthKey는 null로 남긴다 — 실패한 데이터로 빈 날을 판정하지 않는다
      }

      const grouped: Record<string, TicketSummary[]> = {};
      (data as unknown as TicketRow[]).forEach((row) => {
        const kopis = row.kopis_performances;
        // 첨부 이미지는 soft delete를 클라이언트에서 거른다(임베드에 필터를 걸지 않았으므로).
        const firstImage = (row.performance_ticket_images ?? []).find(
          (image) => !image.deleted_at && image.url
        );
        // 썸네일 우선순위: 포스터 → 첨부 1번째 → null.
        // poster는 NULL이 아니라 빈 문자열로 들어있는 공연이 있어 truthy 체크가 필수다.
        const thumbnailUrl = kopis?.poster ? kopis.poster : (firstImage?.url ?? null);
        const summary: TicketSummary = {
          id: row.id,
          watchedOn: row.watched_on,
          title: kopis?.prfnm || row.custom_title || "제목 없음",
          venue: kopis?.fcltynm || row.custom_venue || null,
          rating: row.rating,
          thumbnailUrl,
          isCustom: !row.performance_id,
        };
        (grouped[row.watched_on] ??= []).push(summary);
      });

      setTicketsByDate(grouped);
      setTicketBookMonthData(monthKey, { ticketsByDate: grouped });
      setLoadedMonthKey(monthKey);
      setFetching(false);
    },
    [user, start, end]
  );

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    // 기존 캘린더와 같은 설정을 따른다 — 같은 앱에서 주 시작 요일이 달라 보이지 않도록.
    const { data, error } = await supabase
      .from("profiles")
      .select("calendar_week_start_monday, calendar_highlight_weekend")
      .eq("id", user.id)
      .maybeSingle();
    if (error || !data) return; // 설정 조회 실패는 기본값(일요일 시작)으로 조용히 폴백
    setWeekStartMonday(Boolean(data.calendar_week_start_monday));
    setHighlightWeekend(Boolean(data.calendar_highlight_weekend));
  }, [user]);

  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    if (!user) {
      prevUserIdRef.current = null;
      setTicketsByDate({});
      setLoadedMonthKey(null);
      setFetching(false);
      return;
    }
    const force = consumeTicketChanged();
    if (force) invalidateTicketBookCache();

    const userChanged = prevUserIdRef.current !== user.id;
    prevUserIdRef.current = user.id;
    if (userChanged) {
      // 설정은 월 조회와 병렬로 — 직렬 대기를 늘리지 않는다.
      void Promise.all([fetchTickets(force), fetchSettings()]);
    } else {
      void fetchTickets(force);
    }
  }, [user, loading, start, end, fetchTickets, fetchSettings]);

  // 티켓 생성·수정·삭제 후 돌아왔을 때(bfcache 복귀 포함) 캐시를 비우고 재조회한다.
  useEffect(() => {
    const handleRefresh = () => {
      if (!consumeTicketChanged()) return;
      invalidateTicketBookCache();
      void fetchTickets(true);
    };
    window.addEventListener("pageshow", handleRefresh);
    window.addEventListener("popstate", handleRefresh);
    return () => {
      window.removeEventListener("pageshow", handleRefresh);
      window.removeEventListener("popstate", handleRefresh);
    };
  }, [fetchTickets]);

  useEffect(() => {
    if (!monthSheetOpen) return;
    const handleScroll = () => {
      yearButtonRefs.current[monthDraft.year]?.scrollIntoView({ block: "center" });
      monthButtonRefs.current[monthDraft.month]?.scrollIntoView({ block: "center" });
    };
    // 시트가 렌더된 뒤에 스크롤해야 ref가 채워져 있다.
    const frame = window.setTimeout(handleScroll, 0);
    return () => window.clearTimeout(frame);
  }, [monthSheetOpen, monthDraft.year, monthDraft.month]);

  const changeMonthBy = useCallback((delta: number) => {
    sendHapticToApp();
    setSelectedDate("");
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const point = event.touches[0];
    if (!point) return;
    swipeStartPointRef.current = { x: point.clientX, y: point.clientY };
    swipeHandledRef.current = false;
  }, []);

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (swipeHandledRef.current) {
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

  const handleTouchCancel = useCallback(() => {
    swipeStartPointRef.current = null;
    swipeHandledRef.current = false;
  }, []);

  const weekLabels = useMemo(
    () =>
      weekStartMonday
        ? ["월", "화", "수", "목", "금", "토", "일"]
        : ["일", "월", "화", "수", "목", "금", "토"],
    [weekStartMonday]
  );

  const cells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDay = new Date(year, month, 1).getDay();
    const firstDay = weekStartMonday ? (startDay + 6) % 7 : startDay;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rowCount = Math.ceil((firstDay + daysInMonth) / 7);
    const result: Array<{ date: Date | null; day: number | null }> = [];
    for (let i = 0; i < rowCount * 7; i += 1) {
      const dayNumber = i - firstDay + 1;
      result.push(
        dayNumber < 1 || dayNumber > daysInMonth
          ? { date: null, day: null }
          : { date: new Date(year, month, dayNumber), day: dayNumber }
      );
    }
    return result;
  }, [currentDate, weekStartMonday]);

  const yearOptions = useMemo(() => {
    const thisYear = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => thisYear - 8 + i);
  }, []);
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const selectedTickets = selectedDate ? (ticketsByDate[selectedDate] ?? []) : [];

  const goToNew = useCallback(
    (dateStr?: string) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      try {
        router.push(dateStr ? `/ticket-book/new?date=${dateStr}` : "/ticket-book/new");
      } catch {
        navigatingRef.current = false;
      }
    },
    [router]
  );

  const handleDayTap = (date: Date) => {
    const dateStr = formatSeoulDateKey(date);
    sendHapticToApp();
    if (!user) {
      openLoginSheet();
      return;
    }
    const countsReady = loadedMonthKey === currentMonthKey;
    const isEmptyDay = (ticketsByDate[dateStr]?.length ?? 0) === 0;
    // 이 달 데이터를 실제로 받아온 상태에서 빈 날일 때만 등록 화면으로 보낸다.
    // 아직 로딩 중이면 선택 토글로 폴백해 오탭 이동을 막는다.
    if (countsReady && isEmptyDay) {
      // 다른 날짜를 탭한 것이므로 이전 선택을 먼저 푼다(캘린더와 동일).
      setSelectedDate("");
      goToNew(dateStr);
      return;
    }
    setSelectedDate((prev) => (dateStr === prev ? "" : dateStr));
  };

  if (loading) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  if (!user) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen flex-col">
          <PageHeader title="티켓북" />
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-24">
            <Ticket className="size-10 text-[#17171c]/20" />
            <p className="text-center text-sm text-[#17171c]/60">
              로그인하면 본 공연을 티켓북에 담을 수 있어요
            </p>
            <Button className="h-12 w-full max-w-[240px]" onClick={() => openLoginSheet()}>
              로그인하기
            </Button>
          </div>
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      <main className="flex min-h-screen flex-col px-0 pb-[140px]">
        {/* 티켓북은 1depth가 아니라 뒤로가기로 들어오는 화면이라, 헤더에 화면 이름이
            있어야 여기가 어디인지 알 수 있다. 연월 선택은 아래 라벨이 겸하므로 우측
            슬롯은 비운다 — 비우면 뒤로 버튼과 같은 폭의 스페이서가 들어가 타이틀이
            정확히 가운데에 온다. */}
        <PageHeader title="티켓북" />

        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          {/* 두 번째 줄 — 캘린더 탭 헤더(app/(tabs)/calendar/page.tsx:559-588)와 같은
              규격. 좌측은 연월(탭하면 선택 시트), 우측은 티켓 등록 버튼. */}
          <div className="flex h-12 items-center justify-between px-4">
            <div className="flex items-center gap-0">
              {/* 헤더 타이틀("티켓북")이 text-base라, 연월이 그보다 커지면 위계가
                  뒤집힌다. 같은 크기까지만 쓴다. */}
              <p className="text-base font-semibold">
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
              </p>
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
              aria-label="티켓 등록하기"
              onClick={() => {
                goToNew();
              }}
            >
              <Plus className="size-5" strokeWidth={2.8} />
            </Button>
          </div>
          <section className="grid grid-cols-7 gap-0 px-1 pb-2 pt-2 text-center text-sm text-[#17171c]/60">
            {weekLabels.map((label, index) => (
              <span
                key={`ticket-week-${label}`}
                className={`flex items-center justify-center py-1 ${getWeekdayClass(index, weekStartMonday, highlightWeekend)}`}
              >
                {label}
              </span>
            ))}
          </section>
          <div className="mx-1 h-px bg-[#17171c]/5" />

          <div className="mt-1 grid grid-cols-7 gap-0 px-1">
            {cells.map((cell, index) => {
              if (!cell.date) {
                return <div key={`ticket-empty-${index}`} className="h-[116px]" />;
              }
              const dateStr = formatSeoulDateKey(cell.date);
              const dayTickets = ticketsByDate[dateStr] ?? [];
              const first = dayTickets[0];
              const isSelected = selectedDate === dateStr;
              const isToday = todayStr === dateStr;

              return (
                <button
                  key={`ticket-cell-${dateStr}`}
                  type="button"
                  onClick={() => handleDayTap(cell.date as Date)}
                  className={`flex h-[116px] flex-col items-center justify-start gap-1.5 pt-1.5 active:bg-[#17171c]/5 ${
                    isSelected ? "rounded-md bg-[#17171c]/5" : "rounded-lg"
                  }`}
                >
                  {/* 오늘 표기는 캘린더와 완전히 동일하게 — 검정 원 배경 + 흰 글씨 */}
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${
                      isToday
                        ? "bg-[#17171c] text-white"
                        : isSelected
                          ? "font-bold text-[#17171c]"
                          : getWeekdayClass(index % 7, weekStartMonday, highlightWeekend) || "text-[#17171c]"
                    }`}
                  >
                    {cell.day}
                  </span>
                  {/* 배지 앵커는 셀 전체 폭이 아니라 포스터 실제 크기에 맞춘다 —
                      셀 폭으로 두면 좁은 포스터 오른쪽 허공에 배지가 뜬다. */}
                  <div className="relative h-[60px] w-[42px]">
                    {first ? (
                      <>
                        {first.thumbnailUrl ? (
                          <AnimatedImage
                            src={first.thumbnailUrl}
                            alt=""
                            width={42}
                            height={60}
                            sizes="42px"
                            loading="lazy"
                            className="h-[60px] w-[42px] rounded-md object-cover"
                          />
                        ) : (
                          <div className="h-[60px] w-[42px] rounded-md bg-[#17171c]/5" />
                        )}
                        {dayTickets.length > 1 && (
                          <Badge className="absolute -top-1 right-0.5 min-w-6 justify-center rounded-full bg-primary px-1.5 text-xs text-white">
                            {dayTickets.length}
                          </Badge>
                        )}
                      </>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {fetching && (
          <div className="flex justify-center py-6">
            <Spinner size="lg" />
          </div>
        )}

        {selectedTickets.length > 0 && (
          <section className="mt-2 px-4">
            <ul className="space-y-2">
              {selectedTickets.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => {
                      sendHapticToApp();
                      router.push(`/ticket/${ticket.id}`);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#17171c]/5 bg-white p-3 text-left shadow-sm active:bg-[#17171c]/5"
                  >
                    {ticket.thumbnailUrl ? (
                      <AnimatedImage
                        src={ticket.thumbnailUrl}
                        alt=""
                        width={45}
                        height={64}
                        sizes="45px"
                        loading="lazy"
                        className="h-16 w-[45px] shrink-0 rounded-md bg-[#17171c]/5 object-cover"
                      />
                    ) : (
                      <div className="h-16 w-[45px] shrink-0 rounded-md bg-[#17171c]/5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ticket.title}</p>
                      {ticket.venue && (
                        <p className="truncate text-xs text-[#17171c]/60">{ticket.venue}</p>
                      )}
                      {ticket.rating !== null && (
                        <p className="mt-0.5 text-xs text-brand">
                          ★ {(ticket.rating / 2).toFixed(1)}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-[#17171c]/30" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <BottomSheet open={monthSheetOpen} onOpenChange={setMonthSheetOpen}>
        <div className="grid grid-cols-2 gap-3">
          <div className="no-scrollbar max-h-56 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2">
            {yearOptions.map((year) => (
              <Button
                key={`ticket-year-${year}`}
                ref={(node) => {
                  yearButtonRefs.current[year] = node;
                }}
                type="button"
                variant={monthDraft.year === year ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setMonthDraft((prev) => ({ ...prev, year }))}
              >
                {year}년
              </Button>
            ))}
          </div>
          <div className="no-scrollbar max-h-56 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2">
            {monthOptions.map((month) => (
              <Button
                key={`ticket-month-${month}`}
                ref={(node) => {
                  monthButtonRefs.current[month] = node;
                }}
                type="button"
                variant={monthDraft.month === month ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setMonthDraft((prev) => ({ ...prev, month }))}
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
              setCurrentDate(new Date(monthDraft.year, monthDraft.month - 1, 1));
              setSelectedDate("");
              setMonthSheetOpen(false);
            }}
          >
            적용하기
          </Button>
        </div>
      </BottomSheet>
    </MobileContainer>
  );
}
