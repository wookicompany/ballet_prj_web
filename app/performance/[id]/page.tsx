"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ImageViewer from "@/components/ui/image-viewer";
import FadeInImage from "@/components/ui/fade-in-image";
import { supabase } from "@/lib/supabaseClient";
import { ensureSessionOrLogin } from "@/lib/authSession";
import {
  ChevronLeft,
  Heart,
  MessageCircle,
  MoreHorizontal,
  PenLine,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type RelateItem = {
  relatenm?: string | null;
  relateurl?: string | null;
};

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
  relates: Array<string | RelateItem> | null;
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

const getStarFillRatio = (rating10: number, starIndex: number) => {
  const value = rating10 / 2 - (starIndex - 1);
  return value >= 1 ? 1 : 0;
};

const RECENT_STORAGE_KEY = "recent_performances";
const RECENT_LIMIT = 12;

const toRelateDisplay = (relate: string | RelateItem) => {
  if (typeof relate === "string") {
    const trimmed = relate.trim();
    return trimmed ? { label: trimmed, url: null } : null;
  }
  if (relate && typeof relate === "object") {
    const label =
      typeof relate.relatenm === "string" ? relate.relatenm.trim() : "";
    const url =
      typeof relate.relateurl === "string" ? relate.relateurl.trim() : "";
    if (label || url) {
      return { label: label || url, url: url || null };
    }
  }
  return null;
};

const REVIEW_PAGE_SIZE = 6;

export default function PerformanceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const performanceId = params.id;
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PerformanceDetail | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewAverage, setReviewAverage] = useState<number | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileSummary>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [reviewImages, setReviewImages] = useState<Record<string, string[]>>({});
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);
  const [reviewPage, setReviewPage] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [storyExpanded, setStoryExpanded] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedPagesRef = useRef<Set<number>>(new Set());
  const viewTrackedRef = useRef<string | null>(null);

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
    if (!detail || !user) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
      const parsed = raw
        ? (JSON.parse(raw) as Array<{
            id: string;
            title: string;
            poster: string | null;
          }>)
        : [];
      const next = Array.isArray(parsed) ? parsed : [];
      const filtered = next.filter((item) => item.id !== detail.mt20id);
      filtered.unshift({
        id: detail.mt20id,
        title: detail.prfnm ?? "",
        poster: detail.poster ?? null,
      });
      window.localStorage.setItem(
        RECENT_STORAGE_KEY,
        JSON.stringify(filtered.slice(0, RECENT_LIMIT))
      );
    } catch {
      // ignore localStorage errors
    }
  }, [detail, user]);

  useEffect(() => {
    if (!performanceId) return;
    if (viewTrackedRef.current === performanceId) return;
    viewTrackedRef.current = performanceId;
    fetch(`/api/performances/${performanceId}/view`, { method: "POST" }).catch(
      () => {}
    );
  }, [performanceId]);

  useEffect(() => {
    setReviews([]);
    setProfiles({});
    setLikeCounts({});
    setLikedMap({});
    setCommentCounts({});
    setReviewImages({});
    setHasMoreReviews(true);
    setReviewPage(1);
    requestedPagesRef.current = new Set();
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
      if (requestedPagesRef.current.has(reviewPage)) return;
      requestedPagesRef.current.add(reviewPage);
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
      setReviews((prev) => {
        const merged = [...prev, ...nextRows];
        const seen = new Set<string>();
        return merged.filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      });
      if (nextRows.length < REVIEW_PAGE_SIZE) {
        setHasMoreReviews(false);
      }

      const reviewIds = nextRows.map((row) => row.id);
      const userIds = Array.from(new Set(nextRows.map((row) => row.user_id)));

      if (reviewIds.length > 0) {
        const [
          { data: profileRows },
          { data: likeRows },
          { data: commentRows },
          { data: imageRows },
          { data: likedRows },
        ] = await Promise.all([
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
          supabase
            .from("performance_review_images")
            .select("review_id,url")
            .in("review_id", reviewIds),
          user
            ? supabase
                .from("performance_review_likes")
                .select("review_id")
                .eq("user_id", user.id)
                .in("review_id", reviewIds)
            : Promise.resolve({ data: [] }),
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

        if (user) {
          const nextLiked: Record<string, boolean> = {};
          (likedRows ?? []).forEach((row) => {
            nextLiked[row.review_id] = true;
          });
          setLikedMap((prev) => ({ ...prev, ...nextLiked }));
        }

        const nextCommentCounts: Record<string, number> = {};
        (commentRows ?? []).forEach((row) => {
          nextCommentCounts[row.review_id] =
            (nextCommentCounts[row.review_id] ?? 0) + 1;
        });
        setCommentCounts((prev) => ({ ...prev, ...nextCommentCounts }));

        const nextImages: Record<string, string[]> = {};
        (imageRows ?? []).forEach((row) => {
          if (!row.url) return;
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
  }, [reviewPage, performanceId, hasMoreReviews, user]);

  const refreshReviewSummary = async () => {
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
  };

  const handleToggleLike = async (reviewId: string) => {
    if (!user) {
      openLoginSheet();
      return;
    }

    const isLiked = likedMap[reviewId];
    setLikedMap((prev) => ({ ...prev, [reviewId]: !isLiked }));
    setLikeCounts((prev) => ({
      ...prev,
      [reviewId]: Math.max(0, (prev[reviewId] ?? 0) + (isLiked ? -1 : 1)),
    }));

    if (isLiked) {
      const { error } = await supabase
        .from("performance_review_likes")
        .delete()
        .eq("review_id", reviewId)
        .eq("user_id", user.id);
      if (error) {
        toast("좋아요를 취소하지 못했어요.");
        setLikedMap((prev) => ({ ...prev, [reviewId]: true }));
        setLikeCounts((prev) => ({
          ...prev,
          [reviewId]: (prev[reviewId] ?? 1) + 1,
        }));
      }
      return;
    }

    const { error } = await supabase.from("performance_review_likes").insert({
      review_id: reviewId,
      user_id: user.id,
    });
    if (error) {
      toast("좋아요를 남기지 못했어요.");
      setLikedMap((prev) => ({ ...prev, [reviewId]: false }));
      setLikeCounts((prev) => ({
        ...prev,
        [reviewId]: Math.max(0, (prev[reviewId] ?? 1) - 1),
      }));
    }
  };

  const handleDeleteReview = async () => {
    if (!user || !deleteTargetId) return;
    const target = reviews.find((review) => review.id === deleteTargetId);
    if (!target) {
      toast("삭제할 리뷰를 찾지 못했어요.");
      return;
    }
    if (target.user_id !== user.id) {
      toast("내 리뷰만 삭제할 수 있어요.");
      return;
    }
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) return;
    const response = await fetch(`/api/reviews/${deleteTargetId}/delete`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      toast("리뷰를 삭제하지 못했어요.");
      return;
    }

    setReviews((prev) => prev.filter((review) => review.id !== deleteTargetId));
    setLikeCounts((prev) => {
      const next = { ...prev };
      delete next[deleteTargetId];
      return next;
    });
    setLikedMap((prev) => {
      const next = { ...prev };
      delete next[deleteTargetId];
      return next;
    });
    setCommentCounts((prev) => {
      const next = { ...prev };
      delete next[deleteTargetId];
      return next;
    });
    setReviewImages((prev) => {
      const next = { ...prev };
      delete next[deleteTargetId];
      return next;
    });
    await refreshReviewSummary();
    setDeleteTargetId(null);
  };

  return (
    <MobileContainer>
      <main className="pb-12">
        {loading ? (
          <div className="space-y-5">
            <section className="relative h-[380px] w-full overflow-hidden bg-black/5">
              <Skeleton className="h-full w-full" />
            </section>
            <div className="space-y-4 px-4">
              <section className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <Skeleton className="h-5 w-2/3" />
                <div className="mt-2 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </section>
              <section className="space-y-3 rounded-xl border border-black/5 bg-white p-4">
                <Skeleton className="h-4 w-20" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </section>
              <section className="space-y-3 rounded-xl border border-black/5 bg-white p-4">
                <Skeleton className="h-4 w-20" />
                <div className="flex gap-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={`sty-skeleton-${index}`} className="h-24 w-24" />
                  ))}
                </div>
              </section>
              <section className="space-y-3 rounded-xl border border-black/5 bg-white p-4">
                <Skeleton className="h-4 w-16" />
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div
                      key={`review-skeleton-${index}`}
                      className="rounded-lg border border-black/5 p-3"
                    >
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="mt-2 h-3 w-full" />
                      <Skeleton className="mt-2 h-3 w-2/3" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : !detail ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-[#17171c]/60">
            공연 정보를 찾을 수 없어요.
          </div>
        ) : (
          <div className="space-y-5">
            <section className="relative h-[380px] w-full overflow-hidden bg-black/5">
              {detail.poster ? (
                <>
                  <FadeInImage
                    src={detail.poster}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover blur-2xl"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-white/5" />
                  <button
                    type="button"
                    className="absolute inset-0 h-full w-full"
                    onClick={() => {
                      setViewerUrl(detail.poster);
                      setViewerOpen(true);
                    }}
                    aria-label="포스터 이미지 크게 보기"
                  >
                    <FadeInImage
                      src={detail.poster}
                      alt={`${detail.prfnm ?? "공연"} 포스터`}
                      className="h-full w-full object-contain"
                    />
                  </button>
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
                <h1 className="text-base font-semibold text-[#17171c]">
                  {detail.prfnm || "공연명 미정"}
                </h1>
                <div className="mt-2 grid gap-1 text-xs text-[#17171c]/70">
                  <span>{formatDateRange(detail.prfpdfrom, detail.prfpdto)}</span>
                  <span>{formatOrFallback(detail.fcltynm, "공연장 정보 없음")}</span>
                </div>
              </section>
              <section className="space-y-4 rounded-xl border border-black/5 bg-white p-4 text-xs text-[#17171c]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">공연 정보</h3>
                </div>
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
                      <div key={item.label} className="grid grid-cols-[72px_1fr] gap-2">
                        <span className="text-[#17171c]/50">{item.label}</span>
                        <span className="break-words">{item.value}</span>
                      </div>
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
                    .some(Boolean) ? (
                    <p className="text-[#17171c]/50">정보 없음</p>
                  ) : null}
                </div>
                {formatOptionalText(detail.sty) ? (
                  <>
                    <Separator className="bg-black/5" />
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold">줄거리</h4>
                      <p
                        className={`whitespace-pre-line text-xs text-[#17171c]/70 ${
                          storyExpanded ? "" : "line-clamp-3"
                        }`}
                      >
                        {formatOptionalText(detail.sty)}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1 w-full text-[11px] text-[#17171c]/60"
                        onClick={() => setStoryExpanded((prev) => !prev)}
                      >
                        {storyExpanded ? "접기" : "더보기"}
                      </Button>
                    </div>
                  </>
                ) : null}
              </section>

              {detail.styurls && detail.styurls.length > 0 ? (
                <section className="space-y-3 rounded-xl border border-black/5 bg-white p-4">
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
                        <FadeInImage
                          src={url}
                          alt="소개 이미지"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="space-y-5 rounded-xl border border-black/5 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#17171c]">리뷰</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-[#17171c]/70 hover:bg-black/5"
                    onClick={() => {
                      if (!user) {
                        openLoginSheet();
                        return;
                      }
                      router.push(`/performance/${detail.mt20id}/reviews/new`);
                    }}
                    aria-label="리뷰 작성"
                  >
                    <PenLine className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#17171c]/70">
                  {reviewAverage !== null ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[#ff273d]">
                        <Star className="h-4 w-4 text-[#ff273d]" fill="#ff273d" />
                        {reviewAverage}점
                      </span>
                      <span>• 리뷰 {reviewCount}개</span>
                    </div>
                  ) : (
                    <span>아직 리뷰가 없어요.</span>
                  )}
                </div>
                <div className="space-y-4">
                  {reviews.length === 0 && !loadingReviews ? null : (
                    reviews.map((review) => {
                      const profile = profiles[review.user_id];
                      return (
                        <div
                          key={review.id}
                          className="rounded-lg border border-black/5 p-3 text-sm text-[#17171c]"
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            router.push(
                              `/performance/${detail.mt20id}/reviews/${review.id}`
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              router.push(
                                `/performance/${detail.mt20id}/reviews/${review.id}`
                              );
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 text-xs text-[#17171c]/60">
                            <div className="flex items-start gap-2">
                              <span>
                                {profile?.nickname || "익명"} ·{" "}
                                {formatDate(review.created_at)}
                              </span>
                            </div>
                            {user?.id === review.user_id ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-[#17171c]/60"
                                    aria-label="리뷰 메뉴"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="end"
                                  className="w-36 p-1"
                                >
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start text-sm"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      router.push(
                                        `/performance/${detail.mt20id}/reviews/${review.id}/edit`
                                      );
                                    }}
                                  >
                                    <PenLine className="mr-2 h-4 w-4" />
                                    수정하기
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start text-sm text-red-500 hover:text-red-500"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setDeleteTargetId(review.id);
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    삭제하기
                                  </Button>
                                </PopoverContent>
                              </Popover>
                            ) : null}
                          </div>
                          <div className="mt-2 flex items-center gap-1">
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
                          <p className="mt-3 whitespace-pre-line text-sm text-[#17171c]">
                            {review.content || "내용이 없어요."}
                          </p>
                          {reviewImages[review.id]?.length ? (
                            <div className="mt-3 flex gap-2">
                              {reviewImages[review.id].slice(0, 3).map((url, index) => (
                                <button
                                  key={`${review.id}-img-${index}`}
                                  type="button"
                                  className="h-16 w-16 overflow-hidden rounded-md bg-white"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setViewerUrl(url);
                                    setViewerOpen(true);
                                  }}
                                  aria-label="리뷰 이미지 크게 보기"
                                >
                                  <FadeInImage
                                    src={url}
                                    alt="리뷰 이미지"
                                    className="h-full w-full object-contain"
                                  />
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-3 flex items-center gap-4 text-xs text-[#17171c]">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleToggleLike(review.id);
                              }}
                              aria-label="리뷰 좋아요"
                            >
                              <Heart
                                className="h-4 w-4 text-[#17171c]"
                                fill={likedMap[review.id] ? "#17171c" : "none"}
                              />
                              {likeCounts[review.id] ?? 0}
                            </button>
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle className="h-4 w-4 text-[#17171c]" />
                              {commentCounts[review.id] ?? 0}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {loadingReviews ? (
                    <div className="space-y-3">
                      {Array.from({ length: 2 }).map((_, index) => (
                        <div
                          key={`loading-review-${index}`}
                          className="rounded-lg border border-black/5 p-3"
                        >
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="mt-2 h-3 w-full" />
                          <Skeleton className="mt-2 h-3 w-2/3" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div ref={sentinelRef} />
                </div>
              </section>

              {null}
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
      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>리뷰를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제하면 되돌릴 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-2">
            <AlertDialogCancel className="flex-1">취소</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              className="flex-1 text-red-500 hover:text-red-500"
              onClick={async () => {
                await handleDeleteReview();
              }}
            >
              삭제할게요
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MobileContainer>
  );
}
