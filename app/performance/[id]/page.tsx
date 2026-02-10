"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ImageViewer from "@/components/ui/image-viewer";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, MessageCircle, PenLine, Star, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

type PerformanceDetail = {
  mt20id: string;
  prfnm: string | null;
  prfpdfrom: string | null;
  prfpdto: string | null;
  fcltynm: string | null;
  poster: string | null;
  genrenm: string | null;
  prfstate: string | null;
  area: string | null;
  prfcast: string | null;
  prfcrew: string | null;
  prfruntime: string | null;
  prfage: string | null;
  entrpsnm: string | null;
  entrpsnmP: string | null;
  entrpsnmA: string | null;
  entrpsnmH: string | null;
  entrpsnmS: string | null;
  pcseguidance: string | null;
  sty: string | null;
  child: string | null;
  dtguidance: string | null;
  styurls: string[] | null;
  relates: string[] | null;
};

type ReviewItem = {
  id: string;
  rating: number;
  content: string | null;
  created_at: string;
  user_id: string;
};

type ProfileSummary = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
};

const formatOptionalText = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const formatOrFallback = (value: string | null | undefined, fallback: string) =>
  formatOptionalText(value) ?? fallback;

const formatDateRange = (from?: string | null, to?: string | null) => {
  if (!from && !to) return "공연 기간 정보 없음";
  const start = from ? from.replace(/-/g, ".") : "미정";
  const end = to ? to.replace(/-/g, ".") : "미정";
  return `${start} ~ ${end}`;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR");
};

const REVIEW_PAGE_SIZE = 6;

export default function PerformanceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const performanceId = params.id;
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PerformanceDetail | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewAverage, setReviewAverage] = useState<number | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileSummary>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);
  const [reviewPage, setReviewPage] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      const [{ data: listData, error: listError }, { data: detailData }] =
        await Promise.all([
          supabase
            .from("kopis_performances")
            .select(
              "mt20id,prfnm,prfpdfrom,prfpdto,fcltynm,poster,genrenm,prfstate,area"
            )
            .eq("mt20id", performanceId)
            .maybeSingle(),
          supabase
            .from("kopis_performance_details")
            .select(
              "mt20id,prfcast,prfcrew,prfruntime,prfage,entrpsnm,entrpsnm_p,entrpsnm_a,entrpsnm_h,entrpsnm_s,pcseguidance,sty,child,dtguidance,styurls,relates"
            )
            .eq("mt20id", performanceId)
            .maybeSingle(),
        ]);

      if (listError || !listData) {
        toast("공연 정보를 불러오지 못했어요.");
        setDetail(null);
        setLoading(false);
        return;
      }

      const merged: PerformanceDetail = {
        ...(listData as PerformanceDetail),
        ...(detailData as Partial<PerformanceDetail>),
        entrpsnmP: detailData?.entrpsnm_p ?? null,
        entrpsnmA: detailData?.entrpsnm_a ?? null,
        entrpsnmH: detailData?.entrpsnm_h ?? null,
        entrpsnmS: detailData?.entrpsnm_s ?? null,
      };
      setDetail(merged);

      const { data: ratings } = await supabase
        .from("performance_reviews")
        .select("rating")
        .eq("performance_id", performanceId)
        .is("deleted_at", null);

      if (ratings && ratings.length > 0) {
        const total = ratings.reduce((sum, row) => sum + row.rating, 0);
        setReviewCount(ratings.length);
        setReviewAverage(Math.round((total / ratings.length) * 10) / 10);
      } else {
        setReviewCount(0);
        setReviewAverage(null);
      }
      setLoading(false);
    };

    fetchDetail();
  }, [performanceId]);

  useEffect(() => {
    setReviews([]);
    setProfiles({});
    setLikeCounts({});
    setCommentCounts({});
    setHasMoreReviews(true);
    setReviewPage(0);
  }, [performanceId]);

  useEffect(() => {
    if (loading || loadingReviews || !hasMoreReviews) return;
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setReviewPage((prev) => prev + 1);
        }
      },
      { rootMargin: "120px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loading, loadingReviews, hasMoreReviews]);

  useEffect(() => {
    const fetchReviewsPage = async () => {
      if (reviewPage === 0 || !hasMoreReviews) return;
      setLoadingReviews(true);

      const from = (reviewPage - 1) * REVIEW_PAGE_SIZE;
      const to = from + REVIEW_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("performance_reviews")
        .select("id,rating,content,created_at,user_id")
        .eq("performance_id", performanceId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        toast("리뷰를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setLoadingReviews(false);
        return;
      }

      const nextRows = (data as ReviewItem[]) ?? [];
      setReviews((prev) => [...prev, ...nextRows]);
      if (nextRows.length < REVIEW_PAGE_SIZE) {
        setHasMoreReviews(false);
      }

      const reviewIds = nextRows.map((row) => row.id);
      const userIds = Array.from(new Set(nextRows.map((row) => row.user_id)));

      if (reviewIds.length > 0) {
        const [{ data: profileRows }, { data: likeRows }, { data: commentRows }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("id,nickname,avatar_url")
              .in("id", userIds),
            supabase
              .from("performance_review_likes")
              .select("review_id")
              .in("review_id", reviewIds),
            supabase
              .from("performance_review_comments")
              .select("review_id")
              .in("review_id", reviewIds)
              .is("deleted_at", null),
          ]);

        const nextProfiles: Record<string, ProfileSummary> = {};
        (profileRows ?? []).forEach((row) => {
          nextProfiles[row.id] = row as ProfileSummary;
        });
        setProfiles((prev) => ({ ...prev, ...nextProfiles }));

        const nextLikeCounts: Record<string, number> = {};
        (likeRows ?? []).forEach((row) => {
          nextLikeCounts[row.review_id] =
            (nextLikeCounts[row.review_id] ?? 0) + 1;
        });
        setLikeCounts((prev) => ({ ...prev, ...nextLikeCounts }));

        const nextCommentCounts: Record<string, number> = {};
        (commentRows ?? []).forEach((row) => {
          nextCommentCounts[row.review_id] =
            (nextCommentCounts[row.review_id] ?? 0) + 1;
        });
        setCommentCounts((prev) => ({ ...prev, ...nextCommentCounts }));
      }

      setLoadingReviews(false);
    };

    fetchReviewsPage();
  }, [reviewPage, performanceId, hasMoreReviews]);

  return (
    <MobileContainer>
      <main className="pb-12">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : !detail ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-[#17171c]/60">
            공연 정보를 찾을 수 없어요.
          </div>
        ) : (
          <div className="space-y-6">
            <section className="relative h-[360px] w-full overflow-hidden bg-black/5">
              {detail.poster ? (
                <>
                  <img
                    src={detail.poster}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover blur-2xl"
                  />
                  <div className="absolute inset-0 bg-black/10" />
                  <img
                    src={detail.poster}
                    alt={`${detail.prfnm ?? "공연"} 포스터`}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-[#17171c]/50">
                  포스터 이미지 없음
                </div>
              )}
              <header className="relative z-10 flex items-center justify-between px-4 pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="text-white/80"
                  onClick={() => router.back()}
                  aria-label="뒤로"
                >
                  <ChevronLeft className="size-6" />
                </Button>
                <div className="w-9" />
              </header>
            </section>

            <div className="space-y-4 px-4">
              <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#17171c]/60">
                  {detail.prfstate ? (
                    <Badge variant="secondary">{detail.prfstate}</Badge>
                  ) : null}
                  {detail.genrenm ? <span>{detail.genrenm}</span> : null}
                  {detail.area ? <span>· {detail.area}</span> : null}
                </div>
                <h1 className="mt-2 text-base font-semibold text-[#17171c]">
                  {detail.prfnm || "공연명 미정"}
                </h1>
                <p className="mt-1 text-xs text-[#17171c]/70">
                  {formatDateRange(detail.prfpdfrom, detail.prfpdto)}
                </p>
                <p className="text-xs text-[#17171c]/70">
                  {formatOrFallback(detail.fcltynm, "공연장 정보 없음")}
                </p>
              </section>
              <section className="space-y-4 rounded-xl border border-black/5 bg-white p-4 text-xs text-[#17171c]">
                <h3 className="text-xs font-semibold">공연 정보</h3>
                <div className="space-y-2 text-[#17171c]/70">
                  {[
                    { label: "출연진", value: detail.prfcast },
                    { label: "제작진", value: detail.prfcrew },
                    { label: "러닝타임", value: detail.prfruntime },
                    { label: "관람 연령", value: detail.prfage },
                    { label: "기획제작", value: detail.entrpsnm },
                    { label: "제작사", value: detail.entrpsnmP },
                    { label: "기획사", value: detail.entrpsnmA },
                    { label: "주최", value: detail.entrpsnmH },
                    { label: "주관", value: detail.entrpsnmS },
                    { label: "티켓가격", value: detail.pcseguidance },
                    { label: "공연시간", value: detail.dtguidance },
                  ]
                    .map((item) => ({
                      label: item.label,
                      value: formatOptionalText(item.value),
                    }))
                    .filter((item) => item.value)
                    .map((item) => (
                      <p key={item.label}>
                        {item.label}: {item.value}
                      </p>
                    ))}
                  {![
                    detail.prfcast,
                    detail.prfcrew,
                    detail.prfruntime,
                    detail.prfage,
                    detail.entrpsnm,
                    detail.entrpsnmP,
                    detail.entrpsnmA,
                    detail.entrpsnmH,
                    detail.entrpsnmS,
                    detail.pcseguidance,
                    detail.dtguidance,
                  ]
                    .map(formatOptionalText)
                    .some(Boolean) ? <p>정보 없음</p> : null}
                </div>
                {formatOptionalText(detail.sty) ? (
                  <>
                    <Separator className="bg-black/5" />
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold">줄거리</h4>
                      <p className="whitespace-pre-line text-xs text-[#17171c]/70">
                        {formatOptionalText(detail.sty)}
                      </p>
                    </div>
                  </>
                ) : null}
              </section>

              {detail.styurls && detail.styurls.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-[#17171c]">
                    소개 이미지
                  </h3>
                  <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                    {detail.styurls.map((url, index) => (
                    <button
                        key={`${detail.mt20id}-sty-${index}`}
                      type="button"
                      className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-black/5"
                      onClick={() => {
                        setViewerUrl(url);
                        setViewerOpen(true);
                      }}
                      aria-label="소개 이미지 크게 보기"
                      >
                        <img
                          src={url}
                          alt="소개 이미지"
                          className="h-full w-full object-cover"
                        />
                    </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="space-y-3 rounded-xl border border-black/5 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#17171c]">리뷰</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-[#17171c]/70 hover:bg-black/5"
                    onClick={() =>
                      router.push(`/performance/${detail.mt20id}/reviews/new`)
                    }
                    aria-label="리뷰 작성"
                  >
                    <PenLine className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#17171c]/70">
                  <Star className="h-4 w-4 text-[#ff273d]" />
                  {reviewAverage !== null ? (
                    <span>
                      평균 {reviewAverage}점 · 리뷰 {reviewCount}개
                    </span>
                  ) : (
                    <span>아직 리뷰가 없어요.</span>
                  )}
                </div>
                {reviews.length === 0 && !loadingReviews ? (
                  <p className="text-sm text-[#17171c]/60">
                    아직 리뷰가 없어요.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-dashed border-black/10 bg-black/[0.02] px-3 py-3 text-sm text-[#17171c]/70"
                      onClick={() =>
                        router.push(`/performance/${detail.mt20id}/reviews/new`)
                      }
                    >
                      <span>첫 리뷰를 남겨주세요.</span>
                      <span className="text-xs text-[#17171c]/50">작성하기</span>
                    </button>
                    {reviews.map((review) => {
                      const profile = profiles[review.user_id];
                      return (
                        <div
                          key={review.id}
                          className="rounded-lg border border-black/5 p-3 text-sm text-[#17171c]"
                        >
                          <div className="flex items-center justify-between text-xs text-[#17171c]/60">
                            <span>
                              {profile?.nickname || "익명"} ·{" "}
                              {formatDate(review.created_at)}
                            </span>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }, (_, index) => (
                                <Star
                                  key={`${review.id}-star-${index}`}
                                  className={
                                    index < review.rating
                                      ? "h-4 w-4 text-[#ff273d]"
                                      : "h-4 w-4 text-[#17171c]/15"
                                  }
                                />
                              ))}
                            </div>
                          </div>
                          <p className="mt-2 whitespace-pre-line text-sm text-[#17171c]">
                            {review.content || "내용이 없어요."}
                          </p>
                          <div className="mt-2 flex items-center gap-4 text-xs text-[#17171c]/70">
                            <span className="inline-flex items-center gap-1">
                              <ThumbsUp className="h-4 w-4" />
                              {likeCounts[review.id] ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle className="h-4 w-4" />
                              {commentCounts[review.id] ?? 0}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {loadingReviews ? (
                      <div className="flex justify-center py-2">
                        <Spinner size="sm" />
                      </div>
                    ) : null}
                    {!hasMoreReviews && reviews.length > 0 ? (
                      <p className="text-xs text-[#17171c]/50">
                        모든 리뷰를 불러왔어요.
                      </p>
                    ) : null}
                    <div ref={sentinelRef} />
                  </div>
                )}
              </section>

              {detail.relates && detail.relates.length > 0 ? (
                <section className="space-y-2 rounded-xl border border-black/5 bg-white p-4">
                  <h3 className="text-sm font-semibold text-[#17171c]">
                    예매처
                  </h3>
                  <div className="space-y-1 text-sm text-[#17171c]/70">
                    {detail.relates.map((relate, index) => (
                      <p key={`${detail.mt20id}-relate-${index}`}>{relate}</p>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        )}
      </main>
      <ImageViewer
        isOpen={viewerOpen}
        imageUrl={viewerUrl}
        alt="소개 이미지 크게 보기"
        onClose={() => setViewerOpen(false)}
      />
    </MobileContainer>
  );
}
