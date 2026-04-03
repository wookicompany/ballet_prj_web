"use client";

import { useEffect, useRef, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { formatIsoToSeoulDate } from "@/lib/kstDateTime";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, Heart, MessageCircle, Star } from "lucide-react";

type ReviewSummary = {
  id: string;
  performanceId: string;
  performanceName: string | null;
  performancePoster: string | null;
  content: string | null;
  rating: number;
  createdAt: string;
};

const PAGE_SIZE = 12;

const formatReviewDate = (value: string) => formatIsoToSeoulDate(value, "ko-KR");

const getStarFillRatio = (rating10: number, starIndex: number) => {
  const value = rating10 / 2 - (starIndex - 1);
  return value >= 1 ? 1 : 0;
};

export default function ProfileReviewsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [reviewLikeCounts, setReviewLikeCounts] = useState<Record<string, number>>({});
  const [reviewCommentCounts, setReviewCommentCounts] = useState<Record<string, number>>({});
  const [reviewImages, setReviewImages] = useState<Record<string, string[]>>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedPagesRef = useRef<Set<number>>(new Set());
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      openLoginSheet();
      return;
    }
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

        const { data: reviewRows, error } = await supabase
          .from("performance_reviews")
          .select("id,performance_id,rating,content,created_at")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error || !reviewRows) {
          setHasMore(false);
          return;
        }

        if (reviewRows.length < PAGE_SIZE) {
          setHasMore(false);
        }

        if (reviewRows.length === 0) return;

        const reviewIds = reviewRows.map((r) => r.id);
        const performanceIds = Array.from(new Set(reviewRows.map((r) => r.performance_id)));

        const [performanceRes, likeRes, commentRes, imageRes] = await Promise.all([
          supabase.from("kopis_performances").select("mt20id,prfnm,poster").in("mt20id", performanceIds),
          supabase.from("performance_review_likes").select("review_id").in("review_id", reviewIds).is("deleted_at", null),
          supabase.from("performance_review_comments").select("review_id").in("review_id", reviewIds).is("deleted_at", null),
          supabase.from("performance_review_images").select("review_id,url").in("review_id", reviewIds).eq("user_id", user.id).is("deleted_at", null),
        ]);

        const performanceMap = new Map<string, { name: string | null; poster: string | null }>();
        (performanceRes.data ?? []).forEach((row) => {
          performanceMap.set(row.mt20id, { name: row.prfnm, poster: row.poster });
        });

        const mapped = reviewRows.map((row) => ({
          id: row.id,
          performanceId: row.performance_id,
          performanceName: performanceMap.get(row.performance_id)?.name ?? null,
          performancePoster: performanceMap.get(row.performance_id)?.poster ?? null,
          rating: row.rating,
          content: row.content,
          createdAt: row.created_at,
        }));

        setReviews((prev) => {
          const existing = new Set(prev.map((r) => r.id));
          return [...prev, ...mapped.filter((r) => !existing.has(r.id))];
        });

        const nextLikeCounts: Record<string, number> = {};
        (likeRes.data ?? []).forEach((row) => {
          nextLikeCounts[row.review_id] = (nextLikeCounts[row.review_id] ?? 0) + 1;
        });
        setReviewLikeCounts((prev) => ({ ...prev, ...nextLikeCounts }));

        const nextCommentCounts: Record<string, number> = {};
        (commentRes.data ?? []).forEach((row) => {
          nextCommentCounts[row.review_id] = (nextCommentCounts[row.review_id] ?? 0) + 1;
        });
        setReviewCommentCounts((prev) => ({ ...prev, ...nextCommentCounts }));

        const nextImages: Record<string, string[]> = {};
        (imageRes.data ?? []).forEach((row) => {
          nextImages[row.review_id] = [...(nextImages[row.review_id] ?? []), row.url];
        });
        if (Object.keys(nextImages).length > 0) {
          setReviewImages((prev) => ({ ...prev, ...nextImages }));
        }
      } finally {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    };

    fetchPage();
  }, [page, user, hasMore]);

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
          <h1 className="text-base font-semibold">공연 리뷰</h1>
          <div className="w-10" />
        </header>

        {initialLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`review-skeleton-${index}`}
                className="flex flex-col gap-3 rounded-lg border border-[#17171c]/5 bg-white p-3"
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="h-20 w-14 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm text-[#17171c]/60">아직 리뷰가 없어요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <button
                key={review.id}
                type="button"
                className="flex w-full flex-col rounded-lg border border-[#17171c]/5 bg-white p-3 text-left text-sm"
                onClick={() => {
                  sendHapticToApp();
                  router.push(`/performance/${review.performanceId}/reviews/${review.id}`);
                }}
                aria-label="리뷰 상세 보기"
              >
                <div className="flex w-full items-start gap-3">
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-[#17171c]/5 bg-[#17171c]/5">
                    {review.performancePoster ? (
                      <AnimatedImage
                        src={review.performancePoster}
                        alt={`${review.performanceName ?? "공연"} 포스터`}
                        width={56}
                        height={80}
                        sizes="56px"
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-[#17171c]/50">
                        이미지 없음
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, index) => {
                        const ratio = getStarFillRatio(review.rating, index + 1);
                        return (
                          <div key={`${review.id}-star-${index}`} className="relative h-4 w-4">
                            <Star className="h-4 w-4 text-brand" fill="none" />
                            <div
                              className="absolute inset-0 overflow-hidden"
                              style={{ width: `${ratio * 100}%` }}
                            >
                              <Star className="h-4 w-4 text-brand" fill="currentColor" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {review.content ? (
                      <p className="mt-2 line-clamp-1 text-sm text-[#17171c]/70">{review.content}</p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-xs text-[#17171c]">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-4 w-4 text-[#17171c]" />
                          {reviewLikeCounts[review.id] ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-4 w-4 text-[#17171c]" />
                          {reviewCommentCounts[review.id] ?? 0}
                        </span>
                      </div>
                      <div className="whitespace-nowrap text-xs text-[#17171c]/50">
                        {formatReviewDate(review.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
                {reviewImages[review.id]?.length ? (
                  <div className="mt-2 flex gap-1.5">
                    {reviewImages[review.id].slice(0, 3).map((url, idx) => {
                      const isLast = idx === Math.min(reviewImages[review.id].length, 3) - 1;
                      const remaining = reviewImages[review.id].length - 3;
                      return (
                        <div
                          key={url}
                          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[#17171c]/5"
                        >
                          <AnimatedImage
                            src={url}
                            alt="리뷰 이미지"
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
