"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import FadeInImage from "@/components/ui/fade-in-image";
import {
  formatSeoulDateKey,
  getSeoulTimeParts,
  parseDateKey,
} from "@/lib/kstDateTime";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, Plus } from "lucide-react";

type RecordItem = {
  id: string;
  start_time: string;
  end_time: string;
  content: string;
  mood: number | null;
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
  const dayStripRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const dateStr = params.date;
  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
  const todayKey = useMemo(() => formatSeoulDateKey(), []);

  useEffect(() => {
    const fetchRecords = async () => {
      if (!user) {
        setRecords([]);
        return;
      }
      const { data } = await supabase
        .from("records")
        .select("id,start_time,end_time,content,mood")
        .eq("user_id", user.id)
        .eq("record_date", dateStr)
        .is("deleted_at", null)
        .order("start_time");

      const nextRecords = (data as RecordItem[]) ?? [];
      setRecords(nextRecords);

      if (nextRecords.length === 0) {
        setMediaByRecord({});
        return;
      }

      const recordIds = nextRecords.map((record) => record.id);
      const { data: mediaData } = await supabase
        .from("record_media")
        .select("record_id,url,created_at")
        .in("record_id", recordIds)
        .order("created_at", { ascending: true });

      const nextMedia: Record<string, { url: string | null; count: number }> = {};
      (mediaData ?? []).forEach((item) => {
        const recordId = item.record_id as string;
        if (!nextMedia[recordId]) {
          nextMedia[recordId] = { url: item.url as string, count: 1 };
          return;
        }
        nextMedia[recordId].count += 1;
      });
      setMediaByRecord(nextMedia);
    };

    fetchRecords();
  }, [user, dateStr]);

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
  }, [dateStr, weekDays]);

  return (
    <MobileContainer>
      <main className="flex min-h-screen flex-col bg-white text-[#17171c]">
      <header className="flex items-center justify-between px-4 pt-0">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="text-[#17171c]/70"
          onClick={() => router.push("/calendar")}
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
                    ? "bg-black/5 text-[#17171c] shadow-sm hover:bg-black/5 hover:text-[#17171c]"
                    : "text-[#17171c]/60 hover:bg-transparent hover:text-[#17171c]/60"
                }`}
                onClick={() => router.push(`/day/${item.key}`)}
              >
                <span className="text-[11px]">{item.day}</span>
                <span className="text-sm font-semibold">{item.date}</span>
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
              className="absolute left-0 flex h-10 w-full items-start px-1 text-[11px] text-[#17171c]/45"
              style={{ top: `${(hour - 6) * 60}px` }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
          {nowMinutes !== null && nowMinutes >= 6 * 60 ? (
            <div
              className="absolute left-0 right-0 h-px bg-[#ff273d]"
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
                className="absolute left-12 right-2 h-auto rounded-2xl border border-black/5 bg-white px-3 py-2 text-left text-xs text-[#17171c] shadow-sm hover:bg-white hover:text-[#17171c]"
                style={{ top: `${top}px`, height: `${clampedHeight}px` }}
                onClick={() => router.push(`/record/${record.id}`)}
              >
                <div className="flex h-full w-full items-center justify-between gap-3">
                  {record.mood ? (
                    <FadeInImage
                      src={`/mood/cat-${record.mood}.svg`}
                      alt="오늘 발레 기분"
                      className="h-10 w-10 shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-full bg-black/5" />
                  )}
                  <div className="min-w-0 flex-1 text-center">
                    <p className="line-clamp-2 text-xs font-semibold text-[#17171c]">
                      {record.content || "오늘의 발레를 한줄로 남겨보아요."}
                    </p>
                  </div>
                  {media?.url ? (
                    <div className="relative h-12 w-12 shrink-0 rounded-xl bg-black/5">
                      <FadeInImage
                        src={media.url}
                        alt="기록 미디어"
                        className="h-full w-full rounded-xl object-cover"
                      />
                      {media.count > 1 ? (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#17171c] px-1 text-[10px] font-semibold text-white">
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
      <div className="fixed bottom-6 left-1/2 z-20 flex w-full max-w-[430px] -translate-x-1/2 justify-end px-4">
        <Button
          type="button"
          size="icon-lg"
          className="size-12 rounded-full bg-[#17171c] text-white shadow-lg hover:bg-[#17171c]/90"
          aria-label="기록 등록"
          onClick={() => {
            if (!user) {
              openLoginSheet();
              return;
            }
            router.push(`/record/new?date=${dateStr}`);
          }}
        >
          <Plus className="size-6" strokeWidth={3} />
        </Button>
      </div>
    </main>
    </MobileContainer>
  );
}
