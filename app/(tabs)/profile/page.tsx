"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import ImageViewer from "@/components/ui/image-viewer";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabaseClient";
import { Heart, MessageCircle, Menu, Star, User } from "lucide-react";

type Profile = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR");
};

const getStarFillRatio = (rating10: number, starIndex: number) => {
  const value = rating10 / 2 - (starIndex - 1);
  return Math.min(1, Math.max(0, value));
};

export default function ProfilePage() {
  const router = useRouter();
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

  const reviewSentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedPagesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fetchProfile = async () => {
      if (loading) return;
      if (!user) {
        openLoginSheet();
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id,nickname,avatar_url")
        .eq("id", user.id)
        .single();

      if (!data) {
        await supabase.from("profiles").insert({ id: user.id });
        setProfile({ id: user.id, nickname: null, avatar_url: null });
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
      setReviewCount(count ?? 0);

      setReviews([]);
      setReviewLikeCounts({});
      setReviewCommentCounts({});
      setReviewImages({});
      setHasMoreReviews(true);
      setShowMoreReviews(false);
      setReviewPage(1);
      requestedPagesRef.current = new Set();
    };

    fetchProfile();
  }, [user, router, loading, openLoginSheet]);

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
      if (!user || reviewPage === 0 || !hasMoreReviews) return;
      if (requestedPagesRef.current.has(reviewPage)) return;
      requestedPagesRef.current.add(reviewPage);
      setLoadingReviews(true);

      const pageSize = showMoreReviews
        ? REVIEW_PAGE_SIZE_MORE
        : REVIEW_PAGE_SIZE_INITIAL;
      const from = (reviewPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: reviewRows, error } = await supabase
        .from("performance_reviews")
        .select("id,performance_id,rating,content,created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        setLoadingReviews(false);
        return;
      }

      const nextRows = (reviewRows ?? []) as Array<{
        id: string;
        performance_id: string;
        rating: number;
        content: string | null;
        created_at: string;
      }>;

      if (nextRows.length < pageSize) {
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
            .in("review_id", reviewIds),
          supabase
            .from("performance_review_comments")
            .select("review_id")
            .in("review_id", reviewIds)
            .is("deleted_at", null),
          supabase
            .from("performance_review_images")
            .select("review_id,url")
            .in("review_id", reviewIds)
            .eq("user_id", user.id),
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

      setLoadingReviews(false);
    };

    fetchReviewsPage();
  }, [reviewPage, user, hasMoreReviews, showMoreReviews]);

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
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-[#17171c]/70">
            프로필을 보려면 로그인이 필요해요.
          </p>
        </main>
      </MobileContainer>
    );
  }

  if (!profile) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const displayName = profile.nickname ?? "마이발레";

  return (
    <MobileContainer>
      <main className="px-4 pb-10 pt-8">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold">프로필</h1>
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
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="h-16 w-16 overflow-hidden rounded-full border border-black/10 bg-black/5"
              onClick={() => {
                if (profile.avatar_url) {
                  setAvatarOpen(true);
                }
              }}
              aria-label="프로필 이미지 크게 보기"
              disabled={!profile.avatar_url}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="프로필 이미지"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#17171c]/60">
                  <User className="h-7 w-7" />
                </div>
              )}
            </button>
            <div className="flex-1">
              <p className="text-base font-semibold">{displayName}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-left text-xs text-[#17171c]/70">
            <span>
              총 발레 횟수{" "}
              <span className="font-semibold text-[#17171c]">
                {recordCount}회
              </span>
            </span>
            <span>
              총 발레 시간{" "}
              <span className="font-semibold text-[#17171c]">
                {hours}시간 {minutes}분
              </span>
            </span>
            <span>
              리뷰 수{" "}
              <span className="font-semibold text-[#17171c]">
                {reviewCount}개
              </span>
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => router.push("/profile/edit")}
          >
            프로필 편집
          </Button>
        </section>

        <section className="mt-6 space-y-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#17171c]">내 공연 리뷰</h2>
          </div>

          {reviews.length === 0 && !loadingReviews ? (
            <p className="text-xs text-[#17171c]/60">
              첫 리뷰를 남겨보세요.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="flex w-full items-stretch gap-3 rounded-lg border border-black/5 bg-white p-3 text-left text-sm"
                >
                  <button
                    type="button"
                    className="h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-black/5 bg-black/5"
                    onClick={() =>
                      router.push(
                        `/performance/${review.performanceId}/reviews/${review.id}`
                      )
                    }
                    aria-label="리뷰 상세 보기"
                  >
                    {review.performancePoster ? (
                      <img
                        src={review.performancePoster}
                        alt={`${review.performanceName ?? "공연"} 포스터`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-[#17171c]/50">
                        이미지 없음
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() =>
                      router.push(
                        `/performance/${review.performanceId}/reviews/${review.id}`
                      )
                    }
                    aria-label="리뷰 상세 보기"
                  >
                    <div className="flex h-full flex-col">
                      <div className="flex h-20 flex-col justify-between">
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
                                  className="h-4 w-4 text-[#ff273d]"
                                  fill="none"
                                />
                                <div
                                  className="absolute inset-0 overflow-hidden"
                                  style={{ width: `${ratio * 100}%` }}
                                >
                                  <Star
                                    className="h-4 w-4 text-[#ff273d]"
                                    fill="#ff273d"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="line-clamp-2 text-xs text-[#17171c]/70">
                          {review.content || "내용이 없어요."}
                        </p>
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
                      </div>
                    </div>
                  </button>
                  <div className="flex h-20 w-16 flex-col items-center justify-between gap-2">
                    <div className="text-[11px] text-[#17171c]/50">
                      {formatReviewDate(review.createdAt)}
                    </div>
                    <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-black/5 bg-white">
                      {reviewImages[review.id]?.length ? (
                        <img
                          src={reviewImages[review.id][0]}
                          alt="리뷰 이미지"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-[#17171c]/40">
                          없음
                        </div>
                      )}
                      {reviewImages[review.id]?.length &&
                      reviewImages[review.id].length > 1 ? (
                        <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                          {reviewImages[review.id].length}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {!showMoreReviews && reviewCount > REVIEW_PAGE_SIZE_INITIAL ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
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
        imageUrl={profile.avatar_url}
        alt="프로필 이미지 크게 보기"
        onClose={() => setAvatarOpen(false)}
      />
    </MobileContainer>
  );
}
