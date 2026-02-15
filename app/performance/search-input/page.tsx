"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import FadeInImage from "@/components/ui/fade-in-image";
import { parseDateKey } from "@/lib/kstDateTime";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, MessageCircle, Search, Star } from "lucide-react";
import { toast } from "sonner";

type PerformanceItem = {
  mt20id: string;
  prfnm: string;
  prfpdfrom: string | null;
  prfpdto: string | null;
  fcltynm: string | null;
  poster: string | null;
  genrenm: string | null;
  area: string | null;
};

type RecentPerformance = {
  id: string;
  title: string;
  poster: string | null;
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

const formatDateRange = (from?: string | null, to?: string | null) => {
  if (!from && !to) return "공연 기간 정보 없음";
  const start = from ? from.replace(/-/g, ".") : "미정";
  const end = to ? to.replace(/-/g, ".") : "미정";
  return `${start} ~ ${end}`;
};

const RECENT_STORAGE_KEY = "recent_performances";
const RECENT_SEARCH_KEY = "recent_performance_searches";
const RECENT_SEARCH_LIMIT = 10;
const PAGE_SIZE = 12;

export default function PerformanceSearchInputPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [draft, setDraft] = useState(() => ({
    keyword: "",
  }));
  const [filters, setFilters] = useState(draft);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState<PerformanceItem[]>([]);
  const [ratingMap, setRatingMap] = useState<Record<string, RatingSummary>>({});
  const [engagementMap, setEngagementMap] = useState<
    Record<string, EngagementSummary>
  >({});
  const [recentItems, setRecentItems] = useState<RecentPerformance[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedPagesRef = useRef(new Set<number>());

  useEffect(() => {
    const nextFilters = {
      keyword: "",
    };
    setDraft(nextFilters);
    setFilters(nextFilters);
  }, []);

  useEffect(() => {
    if (!user) {
      setRecentItems([]);
      setRecentSearches([]);
      return;
    }
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as RecentPerformance[]) : [];
      setRecentItems(Array.isArray(parsed) ? parsed : []);
      const searchRaw = window.localStorage.getItem(RECENT_SEARCH_KEY);
      const searchParsed = searchRaw ? (JSON.parse(searchRaw) as string[]) : [];
      setRecentSearches(Array.isArray(searchParsed) ? searchParsed : []);
    } catch {
      setRecentItems([]);
      setRecentSearches([]);
    }
  }, [user]);

  const fetchMatchedIds = useCallback(async (keyword: string) => {
    if (!keyword) return [];
    const keywordLike = `%${keyword}%`;
    const [{ data: nameMatches }, { data: castMatches }] = await Promise.all([
      supabase
        .from("kopis_performances")
        .select("mt20id")
        .ilike("prfnm", keywordLike),
      supabase
        .from("kopis_performance_details")
        .select("mt20id")
        .ilike("prfcast", keywordLike),
    ]);
    const idSet = new Set<string>();
    (nameMatches ?? []).forEach((row) => {
      if (row.mt20id) idSet.add(row.mt20id);
    });
    (castMatches ?? []).forEach((row) => {
      if (row.mt20id) idSet.add(row.mt20id);
    });
    return Array.from(idSet);
  }, []);

  const fetchPage = useCallback(
    async (pageToFetch: number) => {
      const keyword = filters.keyword.trim();
      if (!keyword) {
        setItems([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      if (pageToFetch === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      let ids = matchedIds;
      if (!ids) {
        ids = await fetchMatchedIds(keyword);
        setMatchedIds(ids);
      }

      if (!ids.length) {
        setItems([]);
        setRatingMap({});
        setEngagementMap({});
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const rangeStart = pageToFetch * PAGE_SIZE;
      const rangeEnd = rangeStart + PAGE_SIZE - 1;
      const baseSelect =
        "mt20id,prfnm,prfpdfrom,prfpdto,fcltynm,poster,genrenm,area";

      const { data, error } = await supabase
        .from("kopis_performances")
        .select(baseSelect)
        .is("deleted_at", null)
        .eq("is_active", true)
        .in("mt20id", ids)
        .order("prfpdfrom", { ascending: false })
        .range(rangeStart, rangeEnd);

      if (error) {
        toast("공연 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setItems([]);
        setRatingMap({});
        setEngagementMap({});
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const fetched = (data as PerformanceItem[]) ?? [];
      const targetIds = fetched.map((item) => item.mt20id).filter(Boolean);
      let nextRatingMap: Record<string, RatingSummary> = {};
      let nextEngagementMap: Record<string, EngagementSummary> = {};

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
            .select(
              "performance_id,view_count,review_count,comment_count"
            )
            .in("performance_id", targetIds),
        ]);

        if (reviewError || engagementError) {
          toast("공연 통계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        }

        (reviewRows ?? []).forEach((row) => {
          if (!row.performance_id) return;
          const current = nextRatingMap[row.performance_id] ?? { count: 0, avg: 0 };
          const nextCount = current.count + 1;
          const nextAvg = (current.avg * current.count + row.rating) / nextCount;
          nextRatingMap[row.performance_id] = { count: nextCount, avg: nextAvg };
        });

        (engagementRows ?? []).forEach((row) => {
          if (!row.performance_id) return;
          nextEngagementMap[row.performance_id] = row;
        });

        setRatingMap((prev) => ({ ...prev, ...nextRatingMap }));
        setEngagementMap((prev) => ({ ...prev, ...nextEngagementMap }));
      }

      const getEngagementScore = (itemId: string) => {
        const engagement = nextEngagementMap[itemId] ?? engagementMap[itemId];
        if (!engagement) return 0;
        return (
          (engagement.view_count ?? 0) +
          (engagement.review_count ?? 0) +
          (engagement.comment_count ?? 0)
        );
      };
      const hasEngagement = fetched.some(
        (item) => getEngagementScore(item.mt20id) > 0
      );
      const ordered = [...fetched].sort((a, b) => {
        const dateA = a.prfpdfrom ? parseDateKey(a.prfpdfrom) : null;
        const dateB = b.prfpdfrom ? parseDateKey(b.prfpdfrom) : null;
        const timeA = dateA && !Number.isNaN(dateA.getTime()) ? dateA.getTime() : 0;
        const timeB = dateB && !Number.isNaN(dateB.getTime()) ? dateB.getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        if (hasEngagement) {
          return getEngagementScore(b.mt20id) - getEngagementScore(a.mt20id);
        }
        const ratingA = nextRatingMap[a.mt20id] ?? ratingMap[a.mt20id];
        const ratingB = nextRatingMap[b.mt20id] ?? ratingMap[b.mt20id];
        if (!ratingA && !ratingB) return 0;
        if (!ratingA) return 1;
        if (!ratingB) return -1;
        return ratingB.count - ratingA.count || ratingB.avg - ratingA.avg;
      });

      setItems((prev) => {
        if (pageToFetch === 0) return ordered;
        const seen = new Set(prev.map((item) => item.mt20id));
        const merged = [...prev];
        ordered.forEach((item) => {
          if (!seen.has(item.mt20id)) merged.push(item);
        });
        return merged;
      });

      setHasMore(rangeStart + PAGE_SIZE < ids.length && fetched.length > 0);
      setLoading(false);
      setLoadingMore(false);
    },
    [fetchMatchedIds, filters.keyword, matchedIds]
  );

  const handleSearch = (keyword: string) => {
    if (keyword && user && typeof window !== "undefined") {
      const next = [keyword, ...recentSearches.filter((term) => term !== keyword)];
      const sliced = next.slice(0, RECENT_SEARCH_LIMIT);
      window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(sliced));
      setRecentSearches(sliced);
    }
    setFilters({
      keyword,
    });
    setHasSearched(true);
    setIsFocused(false);
    setPage(0);
    setHasMore(false);
    setMatchedIds(null);
    setRatingMap({});
    setEngagementMap({});
    requestedPagesRef.current = new Set();
  };
  useEffect(() => {
    if (!hasSearched) return;
    fetchPage(0);
  }, [fetchPage, hasSearched]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    const nextPage = page + 1;
    if (requestedPagesRef.current.has(nextPage)) return;
    requestedPagesRef.current.add(nextPage);
    setPage(nextPage);
    fetchPage(nextPage);
  }, [fetchPage, hasMore, loadingMore, page]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || loading || loadingMore || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "120px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading, loadingMore]);

  const handleClearRecent = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RECENT_STORAGE_KEY);
    }
    setRecentItems([]);
  };

  const handleClearRecentSearches = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RECENT_SEARCH_KEY);
    }
    setRecentSearches([]);
  };

  return (
    <MobileContainer>
      <main className="px-4 pb-16 pt-2">
        <header className="flex items-center gap-2 pt-2">
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
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#17171c]/40" />
            <Input
              value={draft.keyword}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, keyword: event.target.value }))
              }
              placeholder="공연명이나 출연진을 검색해요"
              className="h-12 rounded-2xl border border-black/5 bg-white pl-9 text-base shadow-sm"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearch(draft.keyword.trim());
                }
              }}
            />
          </div>
        </header>
        <div className="mt-4 h-px bg-black/5" />

        {isFocused && user ? (
          <section className="mt-5 space-y-3 rounded-2xl border border-black/5 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#17171c]">
                최근 검색어
              </h2>
              {recentSearches.length ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-xs text-[#17171c]/60"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={handleClearRecentSearches}
                >
                  모두 삭제
                </Button>
              ) : null}
            </div>
            {recentSearches.length ? (
              <div className="divide-y divide-black/5">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className="flex w-full items-center py-3 text-left text-sm text-[#17171c]"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      sendHapticToApp();
                      setDraft((prev) => ({ ...prev, keyword: term }));
                      setIsFocused(false);
                      setTimeout(() => handleSearch(term), 0);
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-black/10 text-sm text-[#17171c]/60">
                최근 검색어가 없어요.
              </div>
            )}
          </section>
        ) : null}

        {!hasSearched && !isFocused && user ? (
          <section className="mt-5 space-y-3 rounded-2xl border border-black/5 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#17171c]">
                최근 본 공연
              </h2>
              {recentItems.length ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-xs text-[#17171c]/60"
                  onClick={handleClearRecent}
                >
                  모두 삭제
                </Button>
              ) : null}
            </div>
            {recentItems.length ? (
              <div className="grid grid-cols-3 gap-3">
                {recentItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => router.push(`/performance/${item.id}`)}
                    className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-black/5"
                  >
                    {item.poster ? (
                      <FadeInImage
                        src={item.poster}
                        alt={`${item.title} 포스터`}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-black/10 text-sm text-[#17171c]/60">
                최근 본 공연이 없어요.
              </div>
            )}
          </section>
        ) : null}

        {hasSearched ? (
          <section className="mt-5 overflow-hidden rounded-2xl border border-black/5 bg-white">
          {loading ? (
            <div className="space-y-4 px-4 py-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`search-skeleton-${index}`}
                  className="flex w-full gap-3 border-b border-black/5 pb-4"
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
                className="flex w-full gap-3 border-b border-black/5 px-4 py-4 text-left last:border-b-0"
              >
                <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-black/5">
                  {item.poster ? (
                    <FadeInImage
                      src={item.poster}
                      alt={`${item.prfnm} 포스터`}
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
                    <span className="inline-flex items-center gap-1 text-[#ff273d]">
                      <Star className="h-3 w-3 text-[#ff273d]" fill="#ff273d" />
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
        ) : null}
        {hasSearched && loadingMore ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`search-skeleton-more-${index}`}
                className="flex w-full gap-3 border-b border-black/5 px-4 pb-4"
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
        {hasSearched ? <div ref={sentinelRef} className="h-6" /> : null}
      </main>
    </MobileContainer>
  );
}
