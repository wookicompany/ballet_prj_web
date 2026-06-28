"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import {
  formatSeoulDateKey,
  getSeoulTimeParts,
  parseDateKey,
} from "@/lib/kstDateTime";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, Plus } from "lucide-react";

type RecordMedia = {
  record_id: string;
  url: string | null;
  created_at: string;
  deleted_at: string | null;
};

type RecordItem = {
  id: string;
  start_time: string;
  end_time: string;
  content: string;
  mood: number | null;
  record_media: RecordMedia[];
};

function toMinutes(time: string) {
  const [hh, mm, ss] = time.split(":").map((value) => Number(value));
  return hh * 60 + mm + (ss ? Math.round(ss / 60) : 0);
}

export default function DayPage() {
  const router = useRouter();
  const params = useParams<{ date: string }>();
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [mediaByRecord, setMediaByRecord] = useState<
    Record<string, { url: string | null; count: number }>
  >({});
  const [datesWithRecords, setDatesWithRecords] = useState<Set<string>>(new Set());
  const timelineRef = useRef<HTMLDivElement>(null);

  const dateStr = params.date;
  const todayKey = useMemo(() => formatSeoulDateKey(), []);

  const fetchRecords = useCallback(async () => {
    if (!user) {
      setRecords([]);
      setMediaByRecord({});
      return;
    }
    const { data } = await supabase
      .from("records")
      .select("id,start_time,end_time,content,mood,record_media(record_id,url,created_at,deleted_at)")
      .eq("user_id", user.id)
      .eq("record_date", dateStr)
      .is("deleted_at", null)
      .order("start_time");

    const nextRecords = (data as RecordItem[]) ?? [];
    setRecords(nextRecords);

    // APP_AGENTS.md: deleted_at 소프트 삭제 규칙 — 중첩 select 후 클라이언트 필터링
    const nextMedia: Record<string, { url: string | null; count: number }> = {};
    nextRecords.forEach((record) => {
      const activeMedia = (record.record_media ?? [])
        .filter((m) => !m.deleted_at)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      if (activeMedia.length > 0) {
        nextMedia[record.id] = { url: activeMedia[0].url, count: activeMedia.length };
      }
    });
    setMediaByRecord(nextMedia);
  }, [user, dateStr]);

  const fetchStripCounts = useCallback(async () => {
    if (!user) {
      setDatesWithRecords(new Set());
      return;
    }
    const base = parseDateKey(dateStr);
    if (!base || Number.isNaN(base.getTime())) return;
    const fmt = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };
    const startDate = new Date(base);
    startDate.setDate(base.getDate() - 3);
    const endDate = new Date(base);
    endDate.setDate(base.getDate() + 3);
    const { data } = await supabase
      .from("records")
      .select("record_date")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("record_date", fmt(startDate))
      .lte("record_date", fmt(endDate));
    setDatesWithRecords(new Set((data ?? []).map((r) => r.record_date)));
  }, [user, dateStr]);

  useEffect(() => {
    void Promise.all([fetchRecords(), fetchStripCounts()]);
  }, [fetchRecords, fetchStripCounts]);

  useEffect(() => {
    const handleRefresh = () => {
      const flag = sessionStorage.getItem(`record-changed:${dateStr}`);
      if (!flag) return;
      sessionStorage.removeItem(`record-changed:${dateStr}`);
      void Promise.all([fetchRecords(), fetchStripCounts()]);
    };
    window.addEventListener("pageshow", handleRefresh);
    window.addEventListener("popstate", handleRefresh);
    return () => {
      window.removeEventListener("pageshow", handleRefresh);
      window.removeEventListener("popstate", handleRefresh);
    };
  }, [dateStr, fetchRecords, fetchStripCounts]);

  const hourLabels = useMemo(() => {
    return Array.from({ length: 18 }, (_, idx) => idx + 6);
  }, []);

  const [nowMinutes, setNowMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (dateStr !== todayKey) {
      setNowMinutes(null);
      return;
    }
    const updateNow = () => {
      const { hour, minute } = getSeoulTimeParts();
      setNowMinutes(hour * 60 + minute);
    };
    updateNow();
    const interval = window.setInterval(updateNow, 60 * 1000);
    return () => window.clearInterval(interval);
  }, [dateStr, todayKey]);

  useEffect(() => {
    const container = timelineRef.current;
    if (!container) return;
    if (dateStr !== todayKey || nowMinutes === null) {
      container.scrollTop = 0;
      return;
    }
    const startMinutes = 6 * 60;
    const visibleMinutes = Math.max(nowMinutes - startMinutes, 0);
    const targetTop = visibleMinutes - container.clientHeight / 3;
    const maxScroll = container.scrollHeight - container.clientHeight;
    const clamped = Math.min(Math.max(targetTop, 0), Math.max(maxScroll, 0));
    const scrollNow = () => {
      container.scrollTo({ top: clamped, behavior: "auto" });
    };
    requestAnimationFrame(scrollNow);
    window.setTimeout(scrollNow, 120);
  }, [dateStr, todayKey, nowMinutes, records.length]);

  const dayStrip = useMemo(() => {
    const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
    const base = parseDateKey(dateStr);
    if (!base || Number.isNaN(base.getTime())) return [];
    return Array.from({ length: 7 }, (_, idx) => {
      const offset = idx - 3;
      const nextDate = new Date(base);
      nextDate.setDate(base.getDate() + offset);
      const yyyy = nextDate.getFullYear();
      const mm = String(nextDate.getMonth() + 1).padStart(2, "0");
      const dd = String(nextDate.getDate()).padStart(2, "0");
      return {
        key: `${yyyy}-${mm}-${dd}`,
        day: weekDays[nextDate.getDay()],
        date: String(nextDate.getDate()),
      };
    });
  }, [dateStr]);

  return (
    <MobileContainer>
      <main className="flex min-h-screen flex-col bg-background text-[#17171c]">
      <header className="h-12 flex items-center justify-between px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="text-[#17171c]/70"
          onClick={() => router.back()}
          aria-label="캘린더로 이동"
        >
          <ChevronLeft className="size-6" />
        </Button>
        <div className="text-center">
          <h1 className="text-base font-semibold">{dateStr}</h1>
        </div>
        <div className="w-9" />
      </header>

      <section className="pt-4">
        <div className="flex items-center justify-between px-4 pb-1">
          {dayStrip.map((item) => {
            const isActive = item.key === dateStr;
            return (
              <Button
                key={item.key}
                type="button"
                variant="ghost"
                className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 h-auto font-normal ${
                  isActive
                    ? "bg-[#17171c]/5 text-[#17171c] shadow-sm"
                    : "text-[#17171c]/60"
                }`}
                onClick={() => router.replace(`/day/${item.key}`)}
              >
                <span className="text-xs">{item.day}</span>
                <span className="text-sm font-semibold">{item.date}</span>
                {datesWithRecords.has(item.key) ? (
                  <span className="h-1 w-1 rounded-full bg-[#17171c]/40" />
                ) : (
                  <span className="h-1 w-1" />
                )}
              </Button>
            );
          })}
        </div>
      </section>

      <section
        ref={timelineRef}
        className="flex-1 overflow-y-auto px-4 pb-6 pt-4"
      >
        <div className="relative h-[1080px]">
          {hourLabels.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 flex h-10 w-full items-start px-1 text-xs text-[#17171c]/45"
              style={{ top: `${(hour - 6) * 60}px` }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
          {nowMinutes !== null && nowMinutes >= 6 * 60 ? (
            <div
              className="absolute left-0 right-0 h-px bg-brand"
              style={{ top: `${nowMinutes - 6 * 60}px` }}
            />
          ) : null}
          {records.map((record) => {
            const start = toMinutes(record.start_time);
            const end = toMinutes(record.end_time);
            const height = Math.max(end - start, 10);
            const top = Math.max(start - 6 * 60, 0);
            const clampedHeight = Math.min(height, 1080 - top);
            const media = mediaByRecord[record.id];

            return (
              <Button
                key={record.id}
                type="button"
                className="absolute left-12 right-2 h-auto rounded-2xl border border-[#17171c]/5 bg-white px-2.5 py-1.5 text-left text-sm text-[#17171c] shadow-sm"
                style={{ top: `${top}px`, height: `${clampedHeight}px` }}
                onClick={() => router.push(`/record/${record.id}`)}
              >
                <div className="flex h-full w-full items-center justify-between gap-2">
                  {record.mood ? (
                    <AnimatedImage
                      src={`/mood/mood_dark_face_${record.mood}.png`}
                      alt="오늘 발레 기분"
                      width={1600}
                      height={1600}
                      unoptimized
                      draggable={false}
                      className="h-9 w-9 shrink-0 object-contain"
                    />
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-full bg-[#17171c]/5" />
                  )}
                  <div className="min-w-0 flex-1 text-center">
                    <p className="line-clamp-1 text-sm font-semibold text-[#17171c]">
                      {record.content || "오늘의 발레를 한 줄로 남겨주세요."}
                    </p>
                  </div>
                  {media?.url ? (
                    <div className="relative h-9 w-9 shrink-0 rounded-lg bg-[#17171c]/5">
                      <AnimatedImage
                        src={media.url}
                        alt="기록 미디어"
                        width={36}
                        height={36}
                        sizes="36px"
                        draggable={false}
                        className="h-full w-full rounded-lg object-cover"
                      />
                      {media.count > 1 ? (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#17171c] px-1 text-xs font-semibold text-white">
                          {media.count}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Button>
            );
          })}
        </div>
      </section>
      <div className="fixed bottom-12 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 justify-end px-6">
        <Button
          type="button"
          size="icon-lg"
          className="h-12 w-12 rounded-2xl bg-[#17171c] text-white shadow-lg"
          aria-label="기록 등록"
          onClick={() => {
            if (!user) {
              openLoginSheet();
              return;
            }
            router.push(`/record/new?date=${dateStr}`);
          }}
        >
          <Plus className="size-6" strokeWidth={2.8} />
        </Button>
      </div>
    </main>
    </MobileContainer>
  );
}
