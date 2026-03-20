"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { useRouter, useSearchParams } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatSeoulDateKey,
  getSeoulTodayDate,
  parseDateKey,
} from "@/lib/kstDateTime";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";

type PerformanceItem = {
  mt20id: string;
  prfnm: string;
  prfpdfrom: string | null;
  prfpdto: string | null;
  fcltynm: string | null;
  poster: string | null;
  genrenm: string | null;
  prfstate: string | null;
  area: string | null;
};

type RatingSummary = {
  count: number;
  avg: number;
};

type EngagementSummary = {
  performance_id: string | null;
  view_count?: number | null;
  review_count?: number | null;
  comment_count: number | null;
};

type SectionConfig = {
  title: string;
  prfstate?: string;
  detailFlag?: string;
};

const SECTION_CONFIG: Record<string, SectionConfig> = {
  popular: {
    title: "지금 가장 반응이 많은 공연을 모아봤어요",
  },
  scheduled: {
    title: "곧 만날 수 있는 공연을 모아봤어요",
    prfstate: "공연예정",
  },
  awards: {
    title: "수상작 공연을 모아봤어요",
  },
  ongoing: {
    title: "지금 바로 관람할 수 있어요",
    prfstate: "공연중",
  },
  completed: {
    title: "막을 내린 공연을 모아봤어요",
    prfstate: "공연완료",
  },
  visit: {
    title: "해외 팀이 참여한 공연을 모아봤어요",
    detailFlag: "visit",
  },
  child: {
    title: "아이와 함께 보기 좋은 공연이에요",
    detailFlag: "child",
  },
};

const formatDateRange = (from?: string | null, to?: string | null) => {
  if (!from && !to) return "공연 기간 정보 없음";
  const start = from ? from.replace(/-/g, ".") : "미정";
  const end = to ? to.replace(/-/g, ".") : "미정";
  return `${start} ~ ${end}`;
};

const PAGE_SIZE = 12;

function PerformanceSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionKey = searchParams.get("section") ?? "";
  const sectionConfig = SECTION_CONFIG[sectionKey] ?? null;
  const defaultStart = useMemo(() => formatSeoulDateKey(), []);
  const defaultEnd = useMemo(() => {
    const next = parseDateKey(defaultStart) ?? getSeoulTodayDate();
    next.setMonth(next.getMonth() + 3);
    return formatSeoulDateKey(next);
  }, [defaultStart]);

  const [filters, setFilters] = useState(() => ({
    startDate: sectionConfig ? "" : defaultStart,
    endDate: sectionConfig ? "" : defaultEnd,
  }));
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState<PerformanceItem[]>([]);
  const [ratingMap, setRatingMap] = useState<Record<string, RatingSummary>>({});
  const [engagementMap, setEngagementMap] = useState<
    Record<string, EngagementSummary>
  >({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);
  const [orderedReady, setOrderedReady] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedPagesRef = useRef(new Set<number>());
  const loadingRef = useRef(loading);
  const loadingMoreRef = useRef(loadingMore);

  useEffect(() => {
    const nextFilters = {
      startDate: sectionConfig ? "" : defaultStart,
      endDate: sectionConfig ? "" : defaultEnd,
    };
    setFilters(nextFilters);
  }, [defaultEnd, defaultStart, sectionConfig]);

  const fetchOrderedIds = useCallback(async () => {
    setOrderedReady(false);
    if (sectionKey === "popular") {
      const [
        { data: reviewRows, error: reviewError },
        { data: engagementRows, error: engagementError },
      ] = await Promise.all([
        supabase
          .from("performance_reviews")
          .select("performance_id,rating")
          .is("deleted_at", null),
        supabase
          .from("performance_engagement_summaries")
          .select(
            "performance_id,view_count,review_count,comment_count"
          )
          .or(
            "view_count.gt.0,review_count.gt.0,comment_count.gt.0"
          )
          .range(0, 4999),
      ]);

      if (reviewError || engagementError) {
        toast("공연 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setOrderedIds(null);
        setOrderedReady(true);
        return;
      }

      const engagementList = (engagementRows ?? []) as EngagementSummary[];
      const engagementScores = engagementList
        .filter((item) => item.performance_id)
        .map((item) => ({
          id: item.performance_id as string,
          score:
            (item.view_count ?? 0) +
            (item.review_count ?? 0) +
            (item.comment_count ?? 0),
        }));
      const activeEngagement = engagementScores.filter((item) => item.score > 0);

      if (activeEngagement.length) {
        setOrderedIds(
          activeEngagement
            .sort((a, b) => b.score - a.score)
            .map((item) => item.id)
        );
        setOrderedReady(true);
        return;
      }

      const ratingSummary: Record<string, { count: number; avg: number }> = {};
      (reviewRows ?? []).forEach((row) => {
        if (!row.performance_id) return;
        const current = ratingSummary[row.performance_id] ?? {
          count: 0,
          avg: 0,
        };
        const nextCount = current.count + 1;
        const nextAvg = (current.avg * current.count + row.rating) / nextCount;
        ratingSummary[row.performance_id] = { count: nextCount, avg: nextAvg };
      });

      const popularIds = Object.entries(ratingSummary)
        .sort(
          (a, b) =>
            b[1].count - a[1].count || b[1].avg - a[1].avg
        )
        .map(([id]) => id);

      setOrderedIds(popularIds.length ? popularIds : null);
      setOrderedReady(true);
      return;
    }

    if (sectionConfig?.detailFlag) {
      const { data: detailRows, error: detailError } = await supabase
        .from("kopis_performance_details")
        .select("mt20id")
        .is("deleted_at", null)
        .eq("is_active", true)
        .eq(sectionConfig.detailFlag, "Y")
        .order("updatedate", { ascending: false })
        .limit(1000);

      if (detailError) {
        toast("공연 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setOrderedIds([]);
        setOrderedReady(true);
        return;
      }

      const detailIds = (detailRows ?? [])
        .map((row) => row.mt20id)
        .filter((id): id is string => Boolean(id));
      setOrderedIds(detailIds);
      setOrderedReady(true);
      return;
    }

    if (sectionKey === "awards") {
      const { data: awardRows, error: awardError } = await supabase
        .from("kopis_performance_awards")
        .select("mt20id,prfpdfrom,updated_at")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("prfpdfrom", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1000);

      if (awardError) {
        toast("공연 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setOrderedIds([]);
        setOrderedReady(true);
        return;
      }

      const awardIds = (awardRows ?? [])
        .map((row) => row.mt20id)
        .filter((id): id is string => Boolean(id));
      setOrderedIds(awardIds);
      setOrderedReady(true);
      return;
    }

    setOrderedIds(null);
    setOrderedReady(true);
  }, [sectionConfig, sectionKey]);

  const fetchPage = useCallback(
    async (pageToFetch: number) => {
      if (!orderedReady) return;
      if (pageToFetch === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const baseSelect =
        "mt20id,prfnm,prfpdfrom,prfpdto,fcltynm,poster,genrenm,prfstate,area";
      const rangeStart = pageToFetch * PAGE_SIZE;
      const rangeEnd = rangeStart + PAGE_SIZE - 1;
      let query = supabase
        .from("kopis_performances")
        .select(baseSelect)
        .is("deleted_at", null)
        .eq("is_active", true);

      let sliceIds: string[] | null = null;
      let useOrderedSlice = false;

      if (sectionKey === "popular") {
        if (orderedIds && orderedIds.length) {
          sliceIds = orderedIds.slice(rangeStart, rangeStart + PAGE_SIZE);
          useOrderedSlice = true;
        } else {
          query = query.order("updated_at", { ascending: false });
        }
      } else if (sectionKey === "awards") {
        sliceIds = (orderedIds ?? []).slice(rangeStart, rangeStart + PAGE_SIZE);
        useOrderedSlice = true;
      } else if (sectionConfig?.detailFlag) {
        sliceIds = (orderedIds ?? []).slice(rangeStart, rangeStart + PAGE_SIZE);
        useOrderedSlice = true;
      } else if (sectionKey === "scheduled") {
        const todayDateKey = formatSeoulDateKey();
        query = query
          .eq("prfstate", "공연예정")
          .or(`prfpdto.gte.${todayDateKey},prfpdto.is.null`)
          .order("prfpdfrom", { ascending: true });
      } else if (sectionKey === "ongoing") {
        query = query
          .eq("prfstate", "공연중")
          .order("prfpdto", { ascending: true });
      } else if (sectionKey === "completed") {
        query = query
          .eq("prfstate", "공연완료")
          .order("prfpdto", { ascending: false });
      } else if (sectionConfig?.prfstate) {
        query = query.eq("prfstate", sectionConfig.prfstate);
      } else {
        query = query.order("prfpdfrom", { ascending: true });
      }

      if (filters.startDate) {
        query = query.gte("prfpdto", filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte("prfpdfrom", filters.endDate);
      }

      if (useOrderedSlice) {
        if (!sliceIds || sliceIds.length === 0) {
          if (pageToFetch === 0) {
            setItems([]);
            setRatingMap({});
            setEngagementMap({});
          }
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        query = query.in("mt20id", sliceIds);
      } else {
        query = query.range(rangeStart, rangeEnd);
      }

      const { data, error } = await query;
      if (error) {
        toast("공연 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setItems([]);
        setRatingMap({});
        setEngagementMap({});
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const fetched = (data as PerformanceItem[]) ?? [];
      const ordered = useOrderedSlice && sliceIds
        ? fetched.sort(
            (a, b) => sliceIds.indexOf(a.mt20id) - sliceIds.indexOf(b.mt20id)
          )
        : fetched;

      setItems((prev) => {
        if (pageToFetch === 0) return ordered;
        const seen = new Set(prev.map((item) => item.mt20id));
        const merged = [...prev];
        ordered.forEach((item) => {
          if (!seen.has(item.mt20id)) merged.push(item);
        });
        return merged;
      });

      if (useOrderedSlice && orderedIds) {
        setHasMore(rangeStart + PAGE_SIZE < orderedIds.length);
      } else {
        setHasMore(fetched.length === PAGE_SIZE);
      }

      const targetIds = ordered.map((item) => item.mt20id).filter(Boolean);
      if (targetIds.length) {
        const [
          { data: reviewRows, error: reviewError },
          { data: engagementRows, error: engagementError },
        ] = await Promise.all([
          supabase
            .from("performance_reviews")
            .select("performance_id,rating")
            .is("deleted_at", null)
            .in("performance_id", targetIds),
          supabase
            .from("performance_engagement_summaries")
            .select("performance_id,comment_count")
            .in("performance_id", targetIds),
        ]);

        if (reviewError || engagementError) {
          toast("공연 통계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        }

        const nextRatingMap: Record<string, RatingSummary> = {};
        (reviewRows ?? []).forEach((row) => {
          if (!row.performance_id) return;
          const current = nextRatingMap[row.performance_id] ?? { count: 0, avg: 0 };
          const nextCount = current.count + 1;
          const nextAvg = (current.avg * current.count + row.rating) / nextCount;
          nextRatingMap[row.performance_id] = { count: nextCount, avg: nextAvg };
        });

        const nextEngagementMap: Record<string, EngagementSummary> = {};
        (engagementRows ?? []).forEach((row) => {
          if (!row.performance_id) return;
          nextEngagementMap[row.performance_id] = row;
        });

        setRatingMap((prev) => ({ ...prev, ...nextRatingMap }));
        setEngagementMap((prev) => ({ ...prev, ...nextEngagementMap }));
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [filters, orderedIds, orderedReady, sectionConfig, sectionKey]
  );

  useEffect(() => {
    setItems([]);
    setRatingMap({});
    setEngagementMap({});
    setPage(0);
    setHasMore(true);
    setLoading(true);
    setLoadingMore(false);
    requestedPagesRef.current = new Set();
    fetchOrderedIds();
  }, [fetchOrderedIds]);

  useEffect(() => {
    if (!orderedReady) return;
    fetchPage(0);
  }, [fetchPage, orderedReady]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    const nextPage = page + 1;
    if (requestedPagesRef.current.has(nextPage)) return;
    requestedPagesRef.current.add(nextPage);
    setPage(nextPage);
    fetchPage(nextPage);
  }, [fetchPage, hasMore, loadingMore, page]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingRef.current && !loadingMoreRef.current) {
          loadMore();
        }
      },
      { rootMargin: "120px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <MobileContainer>
      <main className="px-4 pb-16">
        <header className="sticky top-0 z-20 bg-white h-12 mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-base font-semibold">
              {sectionConfig?.title ?? "공연 리스트"}
            </h1>
          </div>
          <div className="w-9" />
        </header>

        <section className="mt-6 space-y-1">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`performance-skeleton-${index}`}
                  className="flex w-full gap-3 border-b border-black/5 py-4"
                >
                  <Skeleton className="h-20 w-14 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                    <div className="flex items-center gap-3 pt-1">
                      <Skeleton className="h-3 w-10" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-[200px] items-center justify-center text-sm text-[#17171c]/60">
              조회된 공연이 없어요.
            </div>
          ) : (
            items.map((item) => {
              const rating = ratingMap[item.mt20id];
              const engagement = engagementMap[item.mt20id];
              return (
                <button
                  key={item.mt20id}
                  type="button"
                  onClick={() => {
                    sendHapticToApp();
                    router.push(`/performance/${item.mt20id}`);
                  }}
                  className="flex w-full gap-3 border-b border-black/5 py-4 text-left"
                >
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-black/5">
                    {item.poster ? (
                      <AnimatedImage
                        src={item.poster}
                        alt={`${item.prfnm} 포스터`}
                        width={56}
                        height={80}
                        sizes="56px"
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="line-clamp-2 text-sm font-semibold text-[#17171c]">
                      {item.prfnm}
                    </h2>
                    <p className="text-xs text-[#17171c]/60">
                      {formatDateRange(item.prfpdfrom, item.prfpdto)}
                    </p>
                    <p className="text-xs text-[#17171c]/60">
                      {item.fcltynm || "공연장 정보 없음"}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#17171c]/70">
                      <span className="inline-flex items-center gap-1 text-brand">
                        <Star className="h-3 w-3 text-brand" fill="currentColor" />
                        {rating ? rating.avg.toFixed(1) : "-"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {engagement?.comment_count ?? 0}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </section>
        {loadingMore ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`performance-skeleton-more-${index}`}
                className="flex w-full gap-3 border-b border-black/5 py-4"
              >
                <Skeleton className="h-20 w-14 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                  <div className="flex items-center gap-3 pt-1">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div ref={sentinelRef} className="h-6" />
      </main>
    </MobileContainer>
  );
}

export default function PerformanceSearchPage() {
  return (
    <Suspense
      fallback={
        <MobileContainer>
          <main className="flex min-h-screen items-center justify-center">
            <Spinner size="lg" />
          </main>
        </MobileContainer>
      }
    >
      <PerformanceSearchContent />
    </Suspense>
  );
}
