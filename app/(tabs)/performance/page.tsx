"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdBanner from "@/components/ads/AdBanner";
import AnimatedImage from "@/components/ui/animated-image";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatSeoulDateKey, getDateKeyDiffDays } from "@/lib/kstDateTime";
import {
  getPerformanceHomeCache,
  setPerformanceHomeCache,
} from "@/lib/performanceHomeCache";
import { getProfileCache } from "@/lib/profileCache";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { ChevronRight, Search, Star } from "lucide-react";
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
  comment_count: number;
};

type SectionBuckets = {
  popular: PerformanceItem[];
  scheduled: PerformanceItem[];
  awards: PerformanceItem[];
  completed: PerformanceItem[];
  visit: PerformanceItem[];
};

type PerformanceHomePayload = {
  ratingMap: Record<string, RatingSummary>;
  sections: SectionBuckets;
  shouldWarn: boolean;
};

type DancerSection = { name: string; items: PerformanceItem[] };
type DancerProfileCache = {
  profile: { favorite_dancer_1: string | null; favorite_dancer_2: string | null } | null;
};

const EMPTY_SECTIONS: SectionBuckets = {
  popular: [],
  scheduled: [],
  awards: [],
  completed: [],
  visit: [],
};

let performanceHomeInFlight: Promise<PerformanceHomePayload> | null = null;

const formatDate = (value?: string | null) => {
  if (!value) return "날짜 미정";
  return value.replace(/-/g, ".");
};

const getDaysUntil = (value?: string | null) => {
  if (!value) return null;
  return getDateKeyDiffDays(value);
};

export default function PerformanceListPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(
    () => !getPerformanceHomeCache<PerformanceHomePayload>()
  );
  const [ratingMap, setRatingMap] = useState<Record<string, RatingSummary>>(
    () => getPerformanceHomeCache<PerformanceHomePayload>()?.ratingMap ?? {}
  );
  const [sections, setSections] = useState<SectionBuckets>(
    () => getPerformanceHomeCache<PerformanceHomePayload>()?.sections ?? EMPTY_SECTIONS
  );
  const [dancerSections, setDancerSections] = useState<DancerSection[]>([]);

  const fetchSections = useCallback(async () => {
    const cached = getPerformanceHomeCache<PerformanceHomePayload>();
    if (cached) {
      setRatingMap(cached.ratingMap);
      setSections(cached.sections);
      setLoading(false);
      return;
    }

    if (!performanceHomeInFlight) {
      performanceHomeInFlight = (async () => {
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
            .select("performance_id,view_count,review_count,comment_count")
            .or("view_count.gt.0,review_count.gt.0,comment_count.gt.0")
            .range(0, 4999),
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
          score: item.view_count * 1 + item.review_count * 10 + item.comment_count * 5,
        }));
        const popularIds = engagementScores
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.id)
          .filter(Boolean)
          .slice(0, 12);

        const popularQuery = popularIds.length
          ? supabase
              .from("kopis_performances")
              .select(baseSelect)
              .is("deleted_at", null)
              .eq("is_active", true)
              .in("mt20id", popularIds)
          : null;

        const todayDateKey = formatSeoulDateKey();

        const scheduledQuery = supabase
          .from("kopis_performances")
          .select(baseSelect)
          .is("deleted_at", null)
          .eq("is_active", true)
          .eq("prfstate", "공연예정")
          .or(`prfpdto.gte.${todayDateKey},prfpdto.is.null`)
          .order("prfpdfrom", { ascending: true })
          .limit(12);

        const completedQuery = supabase
          .from("kopis_performances")
          .select(baseSelect)
          .is("deleted_at", null)
          .eq("is_active", true)
          .eq("prfstate", "공연완료")
          .order("prfpdto", { ascending: false })
          .limit(12);

        const [visitIdsRes, awardIdsRes] = await Promise.all([
          supabase
            .from("kopis_performance_details")
            .select("mt20id")
            .is("deleted_at", null)
            .eq("is_active", true)
            .eq("visit", "Y")
            .order("updatedate", { ascending: false })
            .limit(60),
          supabase
            .from("kopis_performance_awards")
            .select("mt20id,prfpdfrom,updated_at")
            .is("deleted_at", null)
            .eq("is_active", true)
            .order("prfpdfrom", { ascending: false })
            .order("updated_at", { ascending: false })
            .limit(60),
        ]);

        const visitIds = (visitIdsRes.data ?? [])
          .map((row) => row.mt20id)
          .filter(Boolean)
          .slice(0, 12);
        const awardIds = (awardIdsRes.data ?? [])
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
        const awardsQuery = awardIds.length
          ? supabase
              .from("kopis_performances")
              .select(baseSelect)
              .is("deleted_at", null)
              .eq("is_active", true)
              .in("mt20id", awardIds)
          : null;

        const [popularRes, scheduledRes, completedRes, awardsRes, visitRes] =
          await Promise.all([
            popularQuery ?? Promise.resolve({ data: [], error: null }),
            scheduledQuery,
            completedQuery,
            awardsQuery ?? Promise.resolve({ data: [] }),
            visitQuery ?? Promise.resolve({ data: [] }),
          ]);

        if (
          popularRes.error ||
          scheduledRes.error ||
          completedRes.error ||
          awardIdsRes.error ||
          visitIdsRes.error ||
          (awardsRes as { error?: unknown }).error ||
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
        const VISIT_STATE_ORDER: Record<string, number> = { "공연중": 0, "공연예정": 1, "공연완료": 2 };
        const orderedVisit = visitData.sort((a, b) => {
          const stateDiff = (VISIT_STATE_ORDER[a.prfstate ?? ""] ?? 3) - (VISIT_STATE_ORDER[b.prfstate ?? ""] ?? 3);
          if (stateDiff !== 0) return stateDiff;
          return (a.prfpdfrom ?? "").localeCompare(b.prfpdfrom ?? "");
        });
        const awardsData = ((awardsRes as { data?: PerformanceItem[] }).data ??
          []) as PerformanceItem[];
        const orderedAwards = awardIds.length
          ? awardsData.sort(
              (a, b) => awardIds.indexOf(a.mt20id) - awardIds.indexOf(b.mt20id)
            )
          : awardsData;

        return {
          ratingMap: ratingSummary,
          sections: {
            popular: orderedPopular,
            scheduled: (scheduledRes.data ?? []) as PerformanceItem[],
            awards: orderedAwards,
            completed: (completedRes.data ?? []) as PerformanceItem[],
            visit: orderedVisit,
          },
          shouldWarn,
        } satisfies PerformanceHomePayload;
      })();
    }

    setLoading(true);
    try {
      const result = await performanceHomeInFlight;
      setPerformanceHomeCache(result);
      setRatingMap(result.ratingMap);
      setSections(result.sections);
      setLoading(false);

      if (result.shouldWarn) {
        toast("공연 정보를 모두 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setLoading(false);
      toast("공연 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      performanceHomeInFlight = null;
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const fetchDancerSections = useCallback(async () => {
    if (!user) return;

    const cached = getProfileCache<DancerProfileCache>(user.id);
    let dancer1: string | null = null;
    let dancer2: string | null = null;

    if (cached !== null) {
      dancer1 = cached.profile?.favorite_dancer_1 ?? null;
      dancer2 = cached.profile?.favorite_dancer_2 ?? null;
    } else {
      const { data } = await supabase
        .from("profiles")
        .select("favorite_dancer_1,favorite_dancer_2")
        .eq("id", user.id)
        .single();
      dancer1 = data?.favorite_dancer_1 ?? null;
      dancer2 = data?.favorite_dancer_2 ?? null;
    }

    const names = [dancer1, dancer2].filter((n): n is string => !!n);
    if (names.length === 0) {
      setDancerSections([]);
      return;
    }

    const baseSelect =
      "mt20id,prfnm,prfpdfrom,prfpdto,fcltynm,poster,genrenm,prfstate,area";

    const results = await Promise.all(
      names.map(async (name) => {
        const { data: detailRows } = await supabase
          .from("kopis_performance_details")
          .select("mt20id")
          .is("deleted_at", null)
          .eq("is_active", true)
          .ilike("prfcast", `%${name}%`)
          .limit(200);

        const ids = (detailRows ?? []).map((r) => r.mt20id).filter(Boolean);
        if (ids.length === 0) return { name, items: [] as PerformanceItem[] };

        const { data: perfRows } = await supabase
          .from("kopis_performances")
          .select(baseSelect)
          .is("deleted_at", null)
          .eq("is_active", true)
          .in("mt20id", ids)
          .order("prfpdfrom", { ascending: false })
          .limit(12);

        return { name, items: (perfRows ?? []) as PerformanceItem[] };
      })
    );

    setDancerSections(results);
  }, [user]);

  useEffect(() => {
    if (authLoading || loading) return;
    if (!user) return;
    void fetchDancerSections();
  }, [authLoading, loading, user, fetchDancerSections]);

  const renderCard = useCallback(
    (
      item: PerformanceItem,
      options?: {
        badgeLabel?: string | null;
        rating?: RatingSummary;
      }
    ) => {
      return (
        <button
          key={item.mt20id}
          type="button"
          onClick={() => {
            sendHapticToApp();
            router.push(`/performance/${item.mt20id}`);
          }}
          className="flex w-[140px] shrink-0 snap-start flex-col text-left transition-opacity duration-200 active:opacity-70"
        >
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#17171c]/5">
            {options?.badgeLabel ? (
              <Badge className="absolute left-2 top-2 z-10 rounded-md bg-black/70 text-white">
                {options.badgeLabel}
              </Badge>
            ) : null}
            {item.poster ? (
              <AnimatedImage
                src={item.poster}
                alt={`${item.prfnm} 포스터`}
                width={140}
                height={187}
                sizes="140px"
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-[#17171c]/50">
                이미지 없음
              </div>
            )}
          </div>
          <div className="mt-2 flex min-h-[72px] flex-col space-y-1">
            <p className="line-clamp-1 text-sm font-semibold text-[#17171c]">
              {item.prfnm}
            </p>
            <p className="line-clamp-1 text-xs text-[#17171c]/70">
              {item.fcltynm || "공연장 정보 없음"}
            </p>
            <p className="line-clamp-1 text-xs text-[#17171c]/60">
              {formatDate(item.prfpdfrom)}{item.prfpdto && item.prfpdto !== item.prfpdfrom ? ` ~ ${formatDate(item.prfpdto)}` : ""}
            </p>
            <div className="h-4">
              {options?.rating ? (
                <span className="inline-flex items-center gap-1 text-xs text-brand">
                  <Star className="h-3 w-3 fill-current" />
                  {options.rating.avg.toFixed(1)}
                </span>
              ) : (
                <span className="invisible inline-flex items-center gap-1 text-xs">
                  <Star className="h-3 w-3" />
                  0.0
                </span>
              )}
            </div>
          </div>
        </button>
      );
    },
    [router]
  );

  const popularCards = useMemo(
    () => sections.popular.map((item) => renderCard(item, { rating: ratingMap[item.mt20id] })),
    [sections.popular, ratingMap, renderCard]
  );

  const scheduledCards = useMemo(
    () =>
      sections.scheduled.map((item) => {
        const diff = getDaysUntil(item.prfpdfrom);
        const label = diff === null ? null : diff <= 0 ? "D-DAY" : `D-${diff}`;
        return renderCard(item, { badgeLabel: label, rating: ratingMap[item.mt20id] });
      }),
    [sections.scheduled, ratingMap, renderCard]
  );

  const completedCards = useMemo(
    () => sections.completed.map((item) => renderCard(item, { rating: ratingMap[item.mt20id] })),
    [sections.completed, ratingMap, renderCard]
  );

  const awardCards = useMemo(
    () => sections.awards.map((item) => renderCard(item, { rating: ratingMap[item.mt20id] })),
    [sections.awards, ratingMap, renderCard]
  );

  const visitCards = useMemo(
    () => sections.visit.map((item) => renderCard(item, { rating: ratingMap[item.mt20id] })),
    [sections.visit, ratingMap, renderCard]
  );

  const renderSectionSkeleton = (title: string) => (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scroll-px-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={`${title}-skeleton-${index}`} className="w-[140px] shrink-0">
            <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
            <div className="mt-2 space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );


  if (loading) {
    return (
      <>
        <main className="px-4 pb-16">
          <header className="sticky top-0 z-20 bg-background -mx-4 px-4 h-12 mb-4 flex items-center justify-between">
            <h1 className="text-lg font-bold">공연</h1>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="text-[#17171c]/70"
              onClick={() => router.push("/performance/search-input")}
              aria-label="검색"
            >
              <Search className="size-6" />
            </Button>
          </header>
          <section className="mb-4">
            <AdBanner placement="performance_home" />
          </section>

          <div className="space-y-7">
            {renderSectionSkeleton("popular")}
            {renderSectionSkeleton("scheduled")}
            {renderSectionSkeleton("completed")}
            {renderSectionSkeleton("visit")}
            {renderSectionSkeleton("awards")}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <main className="px-4 pb-16">
        <header className="sticky top-0 z-20 bg-background -mx-4 px-4 h-12 mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">공연</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.push("/performance/search-input")}
            aria-label="검색"
          >
            <Search className="size-6" />
          </Button>
        </header>
        <section className="mb-4">
          <AdBanner placement="performance_home" />
        </section>

        <div className="space-y-7">
            {popularCards.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">
                      가장 반응이 많은 공연을 모아봤어요
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
                  {popularCards}
                </div>
              </section>
            )}

            {scheduledCards.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">
                      곧 만날 수 있는 공연을 모아봤어요
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
                  {scheduledCards}
                </div>
              </section>
            )}

            {completedCards.length > 0 && (
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
                  {completedCards}
                </div>
              </section>
            )}

            {visitCards.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">
                      해외 팀이 참여한 공연을 모아봤어요
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-[#17171c]/50"
                    onClick={() => router.push("/performance/search?section=visit")}
                    aria-label="해외 팀 공연 더보기"
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                </div>
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 snap-x snap-mandatory">
                  {visitCards}
                </div>
              </section>
            )}

            {awardCards.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">
                      수상작 공연을 모아봤어요
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-[#17171c]/50"
                    onClick={() => router.push("/performance/search?section=awards")}
                    aria-label="수상작 더보기"
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                </div>
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 snap-x snap-mandatory">
                  {awardCards}
                </div>
              </section>
            )}

            {dancerSections.map(({ name, items }) =>
              items.length > 0 ? (
                <section key={name} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold">
                        {name}님의 공연을 모아봤어요
                      </h2>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-[#17171c]/50"
                      onClick={() =>
                        router.push(
                          `/performance/search?section=${encodeURIComponent(name)}`
                        )
                      }
                      aria-label={`${name} 공연 더보기`}
                    >
                      <ChevronRight className="size-5" />
                    </Button>
                  </div>
                  <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 snap-x snap-mandatory">
                    {items.map((item) =>
                      renderCard(item, { rating: ratingMap[item.mt20id] })
                    )}
                  </div>
                </section>
              ) : null
            )}

        </div>
      </main>
    </>
  );
}
