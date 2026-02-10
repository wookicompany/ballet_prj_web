"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabaseClient";
import { ChevronRight, Info, Search, Star } from "lucide-react";
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
  performance_id: string;
  view_count: number;
  review_count: number;
  like_count: number;
  comment_count: number;
};

const formatDate = (value?: string | null) => {
  if (!value) return "날짜 미정";
  return value.replace(/-/g, ".");
};

const getDaysUntil = (value?: string | null) => {
  if (!value) return null;
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

export default function PerformanceListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ratingMap, setRatingMap] = useState<Record<string, RatingSummary>>({});
  const [sections, setSections] = useState<{
    popular: PerformanceItem[];
    scheduled: PerformanceItem[];
    ongoing: PerformanceItem[];
    completed: PerformanceItem[];
    visit: PerformanceItem[];
  }>({
    popular: [],
    scheduled: [],
    ongoing: [],
    completed: [],
    visit: [],
  });

  const fetchSections = useCallback(async () => {
    setLoading(true);
    const ratingSummary: Record<string, RatingSummary> = {};
    let shouldWarn = false;
    const baseSelect =
      "mt20id,prfnm,prfpdfrom,prfpdto,fcltynm,poster,genrenm,prfstate,area";

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
          "performance_id,view_count,review_count,like_count,comment_count"
        ),
    ]);

    if (reviewError || engagementError) {
      shouldWarn = true;
    }

    (reviewRows ?? []).forEach((row) => {
      if (!row.performance_id) return;
      const current = ratingSummary[row.performance_id] ?? { count: 0, avg: 0 };
      const nextCount = current.count + 1;
      const nextAvg = (current.avg * current.count + row.rating) / nextCount;
      ratingSummary[row.performance_id] = { count: nextCount, avg: nextAvg };
    });

    const engagementList = (engagementRows ?? []) as EngagementSummary[];
    const engagementScores = engagementList.map((item) => ({
      id: item.performance_id,
      score:
        item.view_count +
        item.review_count * 3 +
        item.like_count * 2 +
        item.comment_count * 2,
    }));
    const hasEngagement = engagementScores.some((item) => item.score > 0);
    const popularIds = hasEngagement
      ? engagementScores
          .sort((a, b) => b.score - a.score)
          .map((item) => item.id)
          .slice(0, 12)
      : Object.entries(ratingSummary)
          .sort(
            (a, b) =>
              b[1].count - a[1].count || b[1].avg - a[1].avg
          )
          .map(([id]) => id)
          .slice(0, 12);

    const popularQuery = popularIds.length
      ? supabase
          .from("kopis_performances")
          .select(baseSelect)
          .is("deleted_at", null)
          .eq("is_active", true)
          .in("mt20id", popularIds)
      : supabase
          .from("kopis_performances")
          .select(baseSelect)
          .is("deleted_at", null)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(12);

    const scheduledQuery = supabase
      .from("kopis_performances")
      .select(baseSelect)
      .is("deleted_at", null)
      .eq("is_active", true)
      .eq("prfstate", "공연예정")
      .order("prfpdfrom", { ascending: true })
      .limit(12);

    const ongoingQuery = supabase
      .from("kopis_performances")
      .select(baseSelect)
      .is("deleted_at", null)
      .eq("is_active", true)
      .eq("prfstate", "공연중")
      .order("prfpdto", { ascending: true })
      .limit(12);

    const completedQuery = supabase
      .from("kopis_performances")
      .select(baseSelect)
      .is("deleted_at", null)
      .eq("is_active", true)
      .eq("prfstate", "공연완료")
      .order("prfpdto", { ascending: false })
      .limit(12);

    const [visitIdsRes] = await Promise.all([
      supabase
        .from("kopis_performance_details")
        .select("mt20id")
        .is("deleted_at", null)
        .eq("is_active", true)
        .eq("visit", "Y")
        .order("updatedate", { ascending: false })
        .limit(60),
    ]);

    const visitIds = (visitIdsRes.data ?? [])
      .map((row) => row.mt20id)
      .filter(Boolean)
      .slice(0, 12);

    const visitQuery = visitIds.length
      ? supabase
          .from("kopis_performances")
          .select(baseSelect)
          .is("deleted_at", null)
          .eq("is_active", true)
          .in("mt20id", visitIds)
      : null;
    const [popularRes, scheduledRes, ongoingRes, completedRes, visitRes] =
      await Promise.all([
        popularQuery,
        scheduledQuery,
        ongoingQuery,
        completedQuery,
        visitQuery ?? Promise.resolve({ data: [] }),
      ]);

    if (
      popularRes.error ||
      scheduledRes.error ||
      ongoingRes.error ||
      completedRes.error ||
      visitIdsRes.error ||
      (visitRes as { error?: unknown }).error
    ) {
      shouldWarn = true;
    }

    const popularData = (popularRes.data ?? []) as PerformanceItem[];
    const orderedPopular = popularIds.length
      ? popularData.sort(
          (a, b) => popularIds.indexOf(a.mt20id) - popularIds.indexOf(b.mt20id)
        )
      : popularData;

    const visitData = ((visitRes as { data?: PerformanceItem[] }).data ??
      []) as PerformanceItem[];
    const orderedVisit = visitIds.length
      ? visitData.sort(
          (a, b) => visitIds.indexOf(a.mt20id) - visitIds.indexOf(b.mt20id)
        )
      : visitData;

    setRatingMap(ratingSummary);
    setSections({
      popular: orderedPopular,
      scheduled: (scheduledRes.data ?? []) as PerformanceItem[],
      ongoing: (ongoingRes.data ?? []) as PerformanceItem[],
      completed: (completedRes.data ?? []) as PerformanceItem[],
      visit: orderedVisit,
    });
    setLoading(false);

    if (shouldWarn) {
      toast("공연 정보를 모두 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const renderCard = (
    item: PerformanceItem,
    options?: { badgeLabel?: string | null; metaLabel?: React.ReactNode }
  ) => {
    return (
      <button
        key={item.mt20id}
        type="button"
        onClick={() => router.push(`/performance/${item.mt20id}`)}
        className="w-[140px] shrink-0 snap-start text-left"
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-black/5">
          {options?.badgeLabel ? (
            <Badge className="absolute left-2 top-2 rounded-md bg-black/70 text-white">
              {options.badgeLabel}
            </Badge>
          ) : null}
          {item.poster ? (
            <img
              src={item.poster}
              alt={`${item.prfnm} 포스터`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-[#17171c]/50">
              이미지 없음
            </div>
          )}
        </div>
        <div className="mt-2 space-y-1">
          <p className="line-clamp-1 text-sm font-semibold text-[#17171c]">
            {item.prfnm}
          </p>
          {options?.metaLabel ? (
            <p className="text-xs text-[#17171c]/70">{options.metaLabel}</p>
          ) : null}
          <p className="text-xs text-[#17171c]/60">{formatDate(item.prfpdfrom)}</p>
        </div>
      </button>
    );
  };

  const popularCards = sections.popular.map((item) => {
    const rating = ratingMap[item.mt20id];
    const ratingLabel = rating ? (
      <span className="inline-flex items-center gap-1 text-[#ff273d]">
        <Star className="h-3 w-3 fill-current" />
        {rating.avg.toFixed(1)}
      </span>
    ) : null;
    return renderCard(item, { metaLabel: ratingLabel });
  });

  const scheduledCards = sections.scheduled.map((item) => {
    const diff = getDaysUntil(item.prfpdfrom);
    const label = diff === null ? null : diff <= 0 ? "D-DAY" : `D-${diff}`;
    return renderCard(item, { badgeLabel: label, metaLabel: item.fcltynm });
  });

  const ongoingCards = sections.ongoing.map((item) =>
    renderCard(item, { metaLabel: item.fcltynm })
  );

  const completedCards = sections.completed.map((item) =>
    renderCard(item, { metaLabel: item.fcltynm })
  );

  const visitCards = sections.visit.map((item) =>
    renderCard(item, { metaLabel: item.fcltynm })
  );


  if (loading) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      <main className="px-4 pb-16 pt-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-0">
            <h1 className="text-lg font-semibold">공연</h1>
            <HoverCard>
              <HoverCardTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="-ml-1 text-[#17171c]/70"
                  aria-label="출처 KOPIS"
                >
                  <Info className="size-4" strokeWidth={2.5} />
                </Button>
              </HoverCardTrigger>
              <HoverCardContent className="w-72 text-sm font-semibold text-[#17171c]">
                공연 정보는 KOPIS 데이터를 바탕으로 안내드리고 있어요.
                출처는 (재)예술경영지원센터 공연예술통합전산망이에요.
                사이트 주소는 www.kopis.or.kr이에요.
              </HoverCardContent>
            </HoverCard>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.push("/performance/search")}
            aria-label="검색"
          >
            <Search className="size-6" />
          </Button>
        </header>

        <div className="space-y-7">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    지금 가장 반응이 많은 공연이에요
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-[#17171c]/50"
                  onClick={() => router.push("/performance/search?section=popular")}
                  aria-label="인기 공연 더보기"
                >
                  <ChevronRight className="size-5" />
                </Button>
              </div>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 snap-x snap-mandatory">
                {popularCards.length ? (
                  popularCards
                ) : (
                  <div className="text-sm text-[#17171c]/50">
                    표시할 공연이 없어요.
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    곧 만날 수 있는 공연을 모았어요
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-[#17171c]/50"
                  onClick={() =>
                    router.push("/performance/search?section=scheduled")
                  }
                  aria-label="공연예정 더보기"
                >
                  <ChevronRight className="size-5" />
                </Button>
              </div>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 snap-x snap-mandatory">
                {scheduledCards.length ? (
                  scheduledCards
                ) : (
                  <div className="text-sm text-[#17171c]/50">
                    표시할 공연이 없어요.
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    지금 바로 관람할 수 있어요
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-[#17171c]/50"
                  onClick={() => router.push("/performance/search?section=ongoing")}
                  aria-label="공연중 더보기"
                >
                  <ChevronRight className="size-5" />
                </Button>
              </div>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 snap-x snap-mandatory">
                {ongoingCards.length ? (
                  ongoingCards
                ) : (
                  <div className="text-sm text-[#17171c]/50">
                    표시할 공연이 없어요.
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    해외 팀이 방문하는 공연만 모았어요
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-[#17171c]/50"
                  onClick={() => router.push("/performance/search?section=visit")}
                  aria-label="내한공연 더보기"
                >
                  <ChevronRight className="size-5" />
                </Button>
              </div>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 snap-x snap-mandatory">
                {visitCards.length ? (
                  visitCards
                ) : (
                  <div className="text-sm text-[#17171c]/50">
                    표시할 공연이 없어요.
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    막을 내린 공연을 모아봤어요
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-[#17171c]/50"
                  onClick={() =>
                    router.push("/performance/search?section=completed")
                  }
                  aria-label="공연 완료 더보기"
                >
                  <ChevronRight className="size-5" />
                </Button>
              </div>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 snap-x snap-mandatory">
                {completedCards.length ? (
                  completedCards
                ) : (
                  <div className="text-sm text-[#17171c]/50">
                    표시할 공연이 없어요.
                  </div>
                )}
              </div>
            </section>

        </div>
      </main>
    </MobileContainer>
  );
}
