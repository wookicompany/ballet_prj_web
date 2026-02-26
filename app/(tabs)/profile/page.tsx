"use client";

import { useEffect, useRef, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import ImageViewer from "@/components/ui/image-viewer";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { formatCareerDuration, formatIsoToSeoulDate } from "@/lib/kstDateTime";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { Heart, MessageCircle, Menu, Star, User } from "lucide-react";

type Profile = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  ballet_started_at: string | null;
};

type ReviewSummary = {
  id: string;
  performanceId: string;
  performanceName: string | null;
  performancePoster: string | null;
  content: string | null;
  rating: number;
  createdAt: string;
};

const REVIEW_PAGE_SIZE_INITIAL = 5;
const REVIEW_PAGE_SIZE_MORE = 12;

function toMinutes(time: string) {
  const [hh, mm, ss] = time.split(":").map((value) => Number(value));
  return hh * 60 + mm + (ss ? Math.round(ss / 60) : 0);
}

const formatReviewDate = (value: string) => {
  return formatIsoToSeoulDate(value, "ko-KR");
};

const getStarFillRatio = (rating10: number, starIndex: number) => {
  const value = rating10 / 2 - (starIndex - 1);
  return value >= 1 ? 1 : 0;
};

export default function ProfilePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recordCount, setRecordCount] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [reviewLikeCounts, setReviewLikeCounts] = useState<Record<string, number>>(
    {}
  );
  const [reviewCommentCounts, setReviewCommentCounts] = useState<
    Record<string, number>
  >({});
  const [reviewImages, setReviewImages] = useState<Record<string, string[]>>({});
  const [reviewPage, setReviewPage] = useState(0);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showMoreReviews, setShowMoreReviews] = useState(false);
  const [orderedReviewIds, setOrderedReviewIds] = useState<string[]>([]);
  const [reviewOrderReady, setReviewOrderReady] = useState(false);
  const [reviewSectionLoading, setReviewSectionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const reviewSentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedPagesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fetchProfile = async () => {
      if (loading) return;
      if (pathname !== "/profile") return;
      if (!user) {
        openLoginSheet();
        return;
      }
      setProfileLoading(true);
      setReviewSectionLoading(true);

      const { data } = await supabase
        .from("profiles")
        .select("id,nickname,avatar_url,ballet_started_at")
        .eq("id", user.id)
        .single();

      if (!data) {
        await supabase.from("profiles").insert({ id: user.id });
        setProfile({
          id: user.id,
          nickname: null,
          avatar_url: null,
          ballet_started_at: null,
        });
      } else {
        setProfile(data as Profile);
      }

      const { data: records } = await supabase
        .from("records")
        .select("start_time,end_time")
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (records) {
        setRecordCount(records.length);
        const minutes = records.reduce((sum, record) => {
          return sum + (toMinutes(record.end_time) - toMinutes(record.start_time));
        }, 0);
        setTotalMinutes(minutes);
      }

      const { count } = await supabase
        .from("performance_reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null);
      const nextCount = count ?? 0;
      setReviewCount(nextCount);

      setReviews([]);
      setReviewLikeCounts({});
      setReviewCommentCounts({});
      setReviewImages({});
      setOrderedReviewIds([]);
      setReviewOrderReady(false);
      if (nextCount === 0) {
        setHasMoreReviews(false);
        setShowMoreReviews(false);
        setReviewPage(0);
        setReviewOrderReady(true);
        setReviewSectionLoading(false);
      } else {
        setHasMoreReviews(true);
        setShowMoreReviews(false);
        setReviewPage(1);
      }
      requestedPagesRef.current = new Set();
      setProfileLoading(false);
    };

    fetchProfile();
  }, [user, pathname, loading, openLoginSheet]);

  useEffect(() => {
    const fetchReviewOrder = async () => {
      if (pathname !== "/profile") return;
      if (!user) return;
      if (profileLoading) return;

      if (reviewCount === 0) {
        setOrderedReviewIds([]);
        setHasMoreReviews(false);
        setReviewOrderReady(true);
        setReviewSectionLoading(false);
        return;
      }

      setReviewOrderReady(false);
      setReviewSectionLoading(true);

      const { data: reviewRows, error: reviewError } = await supabase
        .from("performance_reviews")
        .select("id,created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (reviewError) {
        setOrderedReviewIds([]);
        setHasMoreReviews(false);
        setReviewOrderReady(true);
        setReviewSectionLoading(false);
        return;
      }

      const rows = (reviewRows ?? []) as Array<{ id: string; created_at: string }>;
      if (rows.length === 0) {
        setOrderedReviewIds([]);
        setHasMoreReviews(false);
        setReviewOrderReady(true);
        setReviewSectionLoading(false);
        return;
      }

      const reviewIds = rows.map((row) => row.id);
      const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
        supabase
          .from("performance_review_likes")
          .select("review_id")
          .in("review_id", reviewIds)
          .is("deleted_at", null),
        supabase
          .from("performance_review_comments")
          .select("review_id")
          .in("review_id", reviewIds)
          .is("deleted_at", null),
      ]);

      const likeCountByReviewId: Record<string, number> = {};
      (likeRows ?? []).forEach((row) => {
        likeCountByReviewId[row.review_id] =
          (likeCountByReviewId[row.review_id] ?? 0) + 1;
      });

      const commentCountByReviewId: Record<string, number> = {};
      (commentRows ?? []).forEach((row) => {
        commentCountByReviewId[row.review_id] =
          (commentCountByReviewId[row.review_id] ?? 0) + 1;
      });

      const sorted = [...rows].sort((a, b) => {
        const scoreA =
          (likeCountByReviewId[a.id] ?? 0) + (commentCountByReviewId[a.id] ?? 0);
        const scoreB =
          (likeCountByReviewId[b.id] ?? 0) + (commentCountByReviewId[b.id] ?? 0);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setOrderedReviewIds(sorted.map((row) => row.id));
      setHasMoreReviews(true);
      setReviewOrderReady(true);
    };

    fetchReviewOrder();
  }, [user, pathname, reviewCount, profileLoading]);

  useEffect(() => {
    if (!showMoreReviews) return;
    if (!reviewSentinelRef.current || loadingReviews || !hasMoreReviews) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setReviewPage((prev) => prev + 1);
      }
    });
    observer.observe(reviewSentinelRef.current);
    return () => observer.disconnect();
  }, [showMoreReviews, loadingReviews, hasMoreReviews]);

  useEffect(() => {
    const fetchReviewsPage = async () => {
      if (!user || !reviewOrderReady || reviewPage === 0 || !hasMoreReviews) return;
      if (requestedPagesRef.current.has(reviewPage)) return;
      requestedPagesRef.current.add(reviewPage);
      setLoadingReviews(true);
      try {
        const pageSize = showMoreReviews
          ? REVIEW_PAGE_SIZE_MORE
          : REVIEW_PAGE_SIZE_INITIAL;
        const from = (reviewPage - 1) * pageSize;
        const to = from + pageSize - 1;
        const pageReviewIds = orderedReviewIds.slice(from, to + 1);
        if (pageReviewIds.length === 0) {
          setHasMoreReviews(false);
          return;
        }

        const { data: reviewRows, error } = await supabase
          .from("performance_reviews")
          .select("id,performance_id,rating,content,created_at")
          .in("id", pageReviewIds)
          .is("deleted_at", null)
          .eq("user_id", user.id);

        if (error) {
          return;
        }

        const fetchedRows = (reviewRows ?? []) as Array<{
          id: string;
          performance_id: string;
          rating: number;
          content: string | null;
          created_at: string;
        }>;

        const rowMap = new Map(fetchedRows.map((row) => [row.id, row]));
        const nextRows = pageReviewIds
          .map((reviewId) => rowMap.get(reviewId))
          .filter(
            (
              row
            ): row is {
              id: string;
              performance_id: string;
              rating: number;
              content: string | null;
              created_at: string;
            } => Boolean(row)
          );

        if (to >= orderedReviewIds.length - 1) {
          setHasMoreReviews(false);
        }

        const performanceIds = Array.from(
          new Set(nextRows.map((row) => row.performance_id))
        );
        const { data: performanceRows } = await supabase
          .from("kopis_performances")
          .select("mt20id,prfnm,poster")
          .in("mt20id", performanceIds);

        const performanceMap = new Map<
          string,
          { name: string | null; poster: string | null }
        >();
        (performanceRows ?? []).forEach((row) => {
          performanceMap.set(row.mt20id, { name: row.prfnm, poster: row.poster });
        });

        const mapped = nextRows.map((row) => ({
          id: row.id,
          performanceId: row.performance_id,
          performanceName: performanceMap.get(row.performance_id)?.name ?? null,
          performancePoster: performanceMap.get(row.performance_id)?.poster ?? null,
          rating: row.rating,
          content: row.content,
          createdAt: row.created_at,
        }));

        setReviews((prev) => {
          const existing = new Set(prev.map((row) => row.id));
          return [...prev, ...mapped.filter((row) => !existing.has(row.id))];
        });

        const reviewIds = nextRows.map((row) => row.id);
        if (reviewIds.length > 0) {
          const [likeRes, commentRes, imageRes] = await Promise.all([
            supabase
              .from("performance_review_likes")
              .select("review_id")
              .in("review_id", reviewIds)
              .is("deleted_at", null),
            supabase
              .from("performance_review_comments")
              .select("review_id")
              .in("review_id", reviewIds)
              .is("deleted_at", null),
            supabase
              .from("performance_review_images")
              .select("review_id,url")
              .in("review_id", reviewIds)
              .eq("user_id", user.id)
              .is("deleted_at", null),
          ]);

          const nextLikeCounts: Record<string, number> = {};
          (likeRes.data ?? []).forEach((row) => {
            nextLikeCounts[row.review_id] =
              (nextLikeCounts[row.review_id] ?? 0) + 1;
          });
          setReviewLikeCounts((prev) => ({ ...prev, ...nextLikeCounts }));

          const nextCommentCounts: Record<string, number> = {};
          (commentRes.data ?? []).forEach((row) => {
            nextCommentCounts[row.review_id] =
              (nextCommentCounts[row.review_id] ?? 0) + 1;
          });
          setReviewCommentCounts((prev) => ({ ...prev, ...nextCommentCounts }));

          const nextImages: Record<string, string[]> = {};
          (imageRes.data ?? []).forEach((row) => {
            nextImages[row.review_id] = [
              ...(nextImages[row.review_id] ?? []),
              row.url,
            ];
          });
          if (Object.keys(nextImages).length > 0) {
            setReviewImages((prev) => ({ ...prev, ...nextImages }));
          }
        }
      } finally {
        setLoadingReviews(false);
        if (reviewPage === 1) {
          setReviewSectionLoading(false);
        }
      }
    };

    fetchReviewsPage();
  }, [
    reviewPage,
    user,
    hasMoreReviews,
    showMoreReviews,
    orderedReviewIds,
    reviewOrderReady,
  ]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-[#17171c]/70">
          프로필을 보려면 로그인이 필요해요.
        </p>
      </main>
    );
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const displayName = profile?.nickname?.trim()
    ? profile.nickname
    : user.id.slice(0, 8);
  const shouldShowProfileSkeleton = profileLoading || !profile;
  const shouldShowReviewCardSkeleton = profileLoading || reviewSectionLoading;
  const careerDuration = profile?.ballet_started_at
    ? formatCareerDuration(profile.ballet_started_at)
    : null;

  return (
    <>
      <main className="px-4 pb-10 pt-2">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">프로필</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.push("/profile/menu")}
            aria-label="더보기"
          >
            <Menu className="size-6" />
          </Button>
        </header>

        <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          {shouldShowProfileSkeleton ? (
            <>
              <div className="flex items-center gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="mt-4 h-10 w-full rounded-md" />
            </>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="h-20 w-20 overflow-hidden rounded-full border border-black/10 bg-black/5"
                  onClick={() => {
                    if (profile.avatar_url) {
                      setAvatarOpen(true);
                    }
                  }}
                  aria-label="프로필 이미지 크게 보기"
                  disabled={!profile.avatar_url}
                >
                  {profile.avatar_url ? (
                    <AnimatedImage
                      src={profile.avatar_url}
                      alt="프로필 이미지"
                      width={1600}
                      height={1600}
                      unoptimized
                      draggable={false}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#17171c]/60">
                      <User className="h-8 w-8" />
                    </div>
                  )}
                </button>
                <div className="flex-1">
                  <p className="text-base font-semibold">{displayName}</p>
                  {careerDuration ? (
                    <p className="mt-1 text-sm text-[#17171c]/70">
                      발레 경력{" "}
                      <span className="font-semibold text-[#17171c]">
                        {careerDuration}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-black/10 rounded-xl border border-black/5 bg-white py-3">
                <div className="flex flex-col items-center justify-center px-2">
                  <p className="text-sm font-semibold leading-none text-[#17171c]">
                    {recordCount}
                  </p>
                  <p className="mt-2 text-xs text-[#17171c]/60">발레 기록 수</p>
                </div>
                <div className="flex flex-col items-center justify-center px-2">
                  <p className="text-sm font-semibold leading-none text-[#17171c]">
                    {hours}시간 {minutes}분
                  </p>
                  <p className="mt-2 text-xs text-[#17171c]/60">발레 기록 시간</p>
                </div>
                <div className="flex flex-col items-center justify-center px-2">
                  <p className="text-sm font-semibold leading-none text-[#17171c]">
                    {reviewCount}
                  </p>
                  <p className="mt-2 text-xs text-[#17171c]/60">리뷰 작성 수</p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full"
                onClick={() => router.push("/profile/edit")}
              >
                프로필 편집
              </Button>
            </>
          )}
        </section>

        <section className="mt-6 space-y-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            {shouldShowReviewCardSkeleton ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <h2 className="text-base font-semibold text-[#17171c]">공연 리뷰</h2>
            )}
          </div>

          {shouldShowReviewCardSkeleton ? (
            <div className="space-y-3">
              {Array.from({ length: 1 }).map((_, index) => (
                <div
                  key={`profile-review-loading-skeleton-${index}`}
                  className="flex items-start gap-3 rounded-lg border border-black/5 bg-white p-3"
                >
                  <Skeleton className="h-20 w-14 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-xs text-[#17171c]/60">
              첫 리뷰를 남겨보세요.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="flex w-full items-start gap-3 rounded-lg border border-black/5 bg-white p-3 text-left text-sm"
                >
                  <button
                    type="button"
                    className="h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-black/5 bg-black/5"
                    onClick={() => {
                      sendHapticToApp();
                      router.push(
                        `/performance/${review.performanceId}/reviews/${review.id}`
                      );
                    }}
                    aria-label="리뷰 상세 보기"
                  >
                    {review.performancePoster ? (
                      <AnimatedImage
                        src={review.performancePoster}
                        alt={`${review.performanceName ?? "공연"} 포스터`}
                        width={1600}
                        height={1600}
                        unoptimized
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-[#17171c]/50">
                        이미지 없음
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => {
                      sendHapticToApp();
                      router.push(
                        `/performance/${review.performanceId}/reviews/${review.id}`
                      );
                    }}
                    aria-label="리뷰 상세 보기"
                  >
                    <div className="flex h-full flex-col">
                      <div className="flex h-20 flex-col gap-2">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }, (_, index) => {
                            const ratio = getStarFillRatio(
                              review.rating,
                              index + 1
                            );
                            return (
                              <div
                                key={`${review.id}-star-${index}`}
                                className="relative h-4 w-4"
                              >
                                <Star
                                  className="h-4 w-4 text-brand"
                                  fill="none"
                                />
                                <div
                                  className="absolute inset-0 overflow-hidden"
                                  style={{ width: `${ratio * 100}%` }}
                                >
                                  <Star
                                    className="h-4 w-4 text-brand"
                                    fill="currentColor"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {review.content ? (
                          <p className="line-clamp-1 text-sm text-[#17171c]/70">
                            {review.content}
                          </p>
                        ) : null}
                        <div className="mt-auto flex items-center gap-4 text-xs text-[#17171c]">
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-4 w-4 text-[#17171c]" />
                            {reviewLikeCounts[review.id] ?? 0}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="h-4 w-4 text-[#17171c]" />
                            {reviewCommentCounts[review.id] ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                  {reviewImages[review.id]?.length ? (
                    <div className="flex h-20 w-16 flex-col items-center gap-2">
                      <div className="whitespace-nowrap text-xs text-[#17171c]/50">
                        {formatReviewDate(review.createdAt)}
                      </div>
                      <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-black/5 bg-white">
                        <AnimatedImage
                          src={reviewImages[review.id][0]}
                          alt="리뷰 이미지"
                          width={1600}
                          height={1600}
                          unoptimized
                          draggable={false}
                          className="h-full w-full object-contain"
                        />
                        {reviewImages[review.id].length > 1 ? (
                          <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-xs text-white">
                            {reviewImages[review.id].length}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-20 w-16 items-start justify-center">
                      <div className="whitespace-nowrap text-xs text-[#17171c]/50">
                        {formatReviewDate(review.createdAt)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {!showMoreReviews && reviewCount > REVIEW_PAGE_SIZE_INITIAL ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setReviewSectionLoading(true);
                    setShowMoreReviews(true);
                    setReviews([]);
                    setHasMoreReviews(true);
                    setReviewPage(1);
                    requestedPagesRef.current = new Set();
                  }}
                >
                  더 보기
                </Button>
              ) : null}
              {loadingReviews ? (
                <div className="flex justify-center py-2">
                  <Spinner size="sm" />
                </div>
              ) : null}
              <div ref={reviewSentinelRef} />
            </div>
          )}
        </section>
      </main>
      <ImageViewer
        isOpen={avatarOpen}
        imageUrl={profile?.avatar_url ?? null}
        alt="프로필 이미지 크게 보기"
        onClose={() => setAvatarOpen(false)}
      />
    </>
  );
}
