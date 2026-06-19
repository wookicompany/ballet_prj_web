"use client";

import { useEffect, useRef, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { useRouter } from "next/navigation";
import {
  getProfileRecordsCacheUnsafe,
  setProfileRecordsCache,
} from "@/lib/profileRecordsCache";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { formatIsoToSeoulDate } from "@/lib/kstDateTime";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, Quote, Shirt, Star, StickyNote, TrendingUp, User } from "lucide-react";

type RecordSummary = {
  id: string;
  recordDate: string;
  startTime: string;
  endTime: string;
  content: string;
  mood: number | null;
  createdAt: string;
  didWell: string | null;
  improveNext: string | null;
  outfit: string | null;
  memo: string | null;
  workoutTotalEnergyKcal: number | null;
};

type CachePayload = {
  records: RecordSummary[];
  recordMediaById: Record<string, { urls: string[]; count: number }>;
  page: number;
  hasMore: boolean;
};

const PAGE_SIZE = 12;

const formatRecordDate = (value: string) => formatIsoToSeoulDate(value, "ko-KR");
const formatRecordTimeRange = (startTime: string, endTime: string) => {
  return `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}`;
};

export default function ProfileRecordsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  // 첫 렌더 시 동기적으로 캐시 읽기 → 캐시 있으면 즉시 컨텐츠 표시 (스크롤 복원 가능)
  const initialCached = getProfileRecordsCacheUnsafe<CachePayload>();

  const [records, setRecords] = useState<RecordSummary[]>(initialCached?.records ?? []);
  const [recordMediaById, setRecordMediaById] = useState<Record<string, { urls: string[]; count: number }>>(initialCached?.recordMediaById ?? {});
  const [page, setPage] = useState(initialCached?.page ?? 0);
  const [hasMore, setHasMore] = useState(initialCached?.hasMore ?? true);
  const [initialLoading, setInitialLoading] = useState(!initialCached);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedPagesRef = useRef<Set<number>>(
    initialCached
      ? new Set(Array.from({ length: initialCached.page + 1 }, (_, i) => i))
      : new Set(),
  );
  const loadingMoreRef = useRef(false);
  const cacheRestoredRef = useRef(!!initialCached);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      openLoginSheet();
      return;
    }
    if (cacheRestoredRef.current) return;
    cacheRestoredRef.current = true;
    setPage(1);
  }, [user, loading, openLoginSheet]);

  useEffect(() => {
    const fetchPage = async () => {
      if (!user || page === 0 || !hasMore) return;
      if (requestedPagesRef.current.has(page)) return;
      requestedPagesRef.current.add(page);

      if (page === 1) {
        setInitialLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data: recordRows, error } = await supabase
          .from("records")
          .select("id,record_date,start_time,end_time,content,mood,created_at,did_well,improve_next,outfit,memo,workout_total_energy_kcal")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("record_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error || !recordRows) {
          setHasMore(false);
          return;
        }

        const mapped = recordRows.map((row) => ({
          id: row.id,
          recordDate: row.record_date,
          startTime: row.start_time,
          endTime: row.end_time,
          content: row.content,
          mood: row.mood,
          createdAt: row.created_at,
          didWell: row.did_well,
          improveNext: row.improve_next,
          outfit: row.outfit,
          memo: row.memo,
          workoutTotalEnergyKcal: row.workout_total_energy_kcal,
        }));

        setRecords((prev) => {
          const existing = new Set(prev.map((r) => r.id));
          return [...prev, ...mapped.filter((r) => !existing.has(r.id))];
        });

        if (recordRows.length < PAGE_SIZE) {
          setHasMore(false);
        }

        if (recordRows.length > 0) {
          const recordIds = recordRows.map((r) => r.id);
          const { data: mediaRows } = await supabase
            .from("record_media")
            .select("record_id,url,created_at")
            .in("record_id", recordIds)
            .is("deleted_at", null)
            .order("created_at", { ascending: true });

          const nextMediaById: Record<string, { urls: string[]; count: number }> = {};
          (mediaRows ?? []).forEach((row) => {
            if (!nextMediaById[row.record_id]) {
              nextMediaById[row.record_id] = { urls: [row.url], count: 1 };
              return;
            }
            nextMediaById[row.record_id].count += 1;
            if (nextMediaById[row.record_id].urls.length < 3) {
              nextMediaById[row.record_id].urls.push(row.url);
            }
          });
          if (Object.keys(nextMediaById).length > 0) {
            setRecordMediaById((prev) => ({ ...prev, ...nextMediaById }));
          }
        }
      } finally {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    };

    fetchPage();
  }, [page, user, hasMore]);

  useEffect(() => {
    if (!user || initialLoading) return;
    setProfileRecordsCache<CachePayload>(user.id, {
      records,
      recordMediaById,
      page,
      hasMore,
    });
  }, [user, records, recordMediaById, page, hasMore, initialLoading]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || loadingMoreRef.current) return;
      setPage((prev) => prev + 1);
    });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, initialLoading]);

  return (
    <MobileContainer>
      <main className="px-4 pb-10">
        <header className="sticky top-0 z-20 bg-white h-12 mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]"
            onClick={() => router.back()}
            aria-label="뒤로가기"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <h1 className="text-base font-semibold">발레 기록</h1>
          <div className="w-10" />
        </header>

        {initialLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`record-skeleton-${index}`}
                className="flex items-start gap-3 rounded-lg border border-[#17171c]/5 bg-white p-3"
              >
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm text-[#17171c]/60">아직 기록이 없어요. 오늘의 발레를 기록해보세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <button
                key={record.id}
                type="button"
                className="flex w-full items-start gap-3 rounded-lg border border-[#17171c]/5 bg-white p-4 text-left text-sm"
                onClick={() => {
                  sendHapticToApp();
                  router.push(`/record/${record.id}`);
                }}
                aria-label="기록 상세 보기"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                  {record.mood ? (
                    <AnimatedImage
                      src={`/mood/mood_dark_face_${record.mood}.png`}
                      alt={`기분 ${record.mood}단계`}
                      width={1600}
                      height={1600}
                      unoptimized
                      draggable={false}
                      className="h-10 w-10 object-contain"
                    />
                  ) : (
                    <User className="h-5 w-5 text-[#17171c]/45" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-[#17171c]/60">
                      <span>{formatRecordTimeRange(record.startTime, record.endTime)}</span>
                      {record.workoutTotalEnergyKcal != null && (
                        <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-orange-400">
                          {record.workoutTotalEnergyKcal} kcal
                        </span>
                      )}
                    </div>
                    <p className="shrink-0 text-right text-xs text-[#17171c]/60">
                      {formatRecordDate(record.recordDate)}
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {record.content?.trim() && (
                      <p className="line-clamp-2 flex items-start gap-1.5 text-sm text-[#17171c]">
                        <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                        {record.content}
                      </p>
                    )}
                    {record.didWell && (
                      <p className="line-clamp-2 flex items-start gap-1.5 text-sm text-[#17171c]">
                        <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                        {record.didWell}
                      </p>
                    )}
                    {record.improveNext && (
                      <p className="line-clamp-2 flex items-start gap-1.5 text-sm text-[#17171c]">
                        <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        {record.improveNext}
                      </p>
                    )}
                    {record.outfit && (
                      <p className="line-clamp-2 flex items-start gap-1.5 text-sm text-[#17171c]">
                        <Shirt className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-400" />
                        {record.outfit}
                      </p>
                    )}
                    {record.memo && (
                      <p className="line-clamp-2 flex items-start gap-1.5 text-sm text-[#17171c]">
                        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                        {record.memo}
                      </p>
                    )}
                  </div>
                  {recordMediaById[record.id] ? (
                    <div className="mt-2 flex gap-1.5">
                      {recordMediaById[record.id].urls.map((url, idx) => {
                        const isLast = idx === recordMediaById[record.id].urls.length - 1;
                        const remaining = recordMediaById[record.id].count - recordMediaById[record.id].urls.length;
                        return (
                          <div
                            key={url}
                            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[#17171c]/5"
                          >
                            <AnimatedImage
                              src={url}
                              alt="기록 미디어"
                              width={64}
                              height={64}
                              sizes="64px"
                              draggable={false}
                              className="h-full w-full object-cover"
                            />
                            {isLast && remaining > 0 ? (
                              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50">
                                <span className="text-sm font-medium text-white">+{remaining}</span>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </button>
            ))}
            {loadingMore ? (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : null}
            <div ref={sentinelRef} />
          </div>
        )}
      </main>
    </MobileContainer>
  );
}
