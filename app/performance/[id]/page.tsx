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
import BottomSheet from "@/components/sheets/BottomSheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import ImageViewer from "@/components/ui/image-viewer";
import FadeInImage from "@/components/ui/fade-in-image";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { formatIsoToSeoulDate } from "@/lib/kstDateTime";
import {
  REPORT_REASON_OPTIONS,
  REPORT_THRESHOLD,
  type ReportReasonCode,
} from "@/lib/reports";
import { supabase } from "@/lib/supabaseClient";
import { ensureSessionOrLogin } from "@/lib/authSession";
import {
  ChevronLeft,
  Copy,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Flag,
  PenLine,
  Star,
  Trophy,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type RelateItem = {
  relatenm?: string | null;
  relateurl?: string | null;
};

type PerformanceDetail = {
  mt20id: string;
  mt10id?: string | null;
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
  report_count?: number;
};

type ProfileSummary = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
};

type FacilityDetail = {
  mt10id: string;
  adres: string | null;
  telno: string | null;
  relateurl: string | null;
  parkinglot: string | null;
  restaurant: string | null;
  cafe: string | null;
  store: string | null;
  nolibang: string | null;
  suyu: string | null;
  parkbarrier: string | null;
  restbarrier: string | null;
  runwbarrier: string | null;
  elevbarrier: string | null;
};

type AwardDetail = {
  awards: string | null;
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
  return formatIsoToSeoulDate(value, "ko-KR");
};

const formatRatingText = (value: number) => {
  return value.toFixed(1);
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

const REVIEW_PAGE_SIZE = 12;
const toYesLabel = (value?: string | null) => (value === "Y" ? "있음" : null);

const getDisplayNickname = (nickname: string | null | undefined, userId: string) => {
  const trimmed = nickname?.trim();
  if (trimmed) return trimmed;
  return userId.slice(0, 8);
};

const fetchPublicProfiles = async (
  userIds: string[]
): Promise<Record<string, ProfileSummary>> => {
  const deduped = Array.from(new Set(userIds.filter(Boolean)));
  if (deduped.length === 0) return {};

  const response = await fetch("/api/public-profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_ids: deduped }),
  });
  if (!response.ok) return {};

  const payload = (await response.json()) as { items?: ProfileSummary[] };
  const next: Record<string, ProfileSummary> = {};
  (payload.items ?? []).forEach((item) => {
    next[item.id] = item;
  });
  return next;
};

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
  const [reviewReportCounts, setReviewReportCounts] = useState<
    Record<string, number>
  >({});
  const [facilityDetail, setFacilityDetail] = useState<FacilityDetail | null>(null);
  const [awardDetail, setAwardDetail] = useState<AwardDetail | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [hasMoreReviews, setHasMoreReviews] = useState(true);
  const [reviewPage, setReviewPage] = useState(0);
  const [orderedReviewIds, setOrderedReviewIds] = useState<string[]>([]);
  const [reviewOrderReady, setReviewOrderReady] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [activeVisualIndex, setActiveVisualIndex] = useState(0);
  const [visualApi, setVisualApi] = useState<CarouselApi>();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReasonCode>("SPAM");
  const [reportDetail, setReportDetail] = useState("");
  const [reporting, setReporting] = useState(false);
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [infoTab, setInfoTab] = useState<"performance" | "facility">(
    "performance",
  );
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
              "mt20id,mt10id,prfcast,prfcrew,prfruntime,prfage,entrpsnm,entrpsnm_p,entrpsnm_a,entrpsnm_h,entrpsnm_s,pcseguidance,sty,child,dtguidance,styurls,relates"
            )
            .eq("mt20id", performanceId)
            .maybeSingle(),
        ]);

      if (listError || !listData) {
        toast("공연 정보를 불러오지 못했어요.");
        setDetail(null);
        setFacilityDetail(null);
        setAwardDetail(null);
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
      const { data: awardData } = await supabase
        .from("kopis_performance_awards")
        .select("awards")
        .eq("mt20id", performanceId)
        .is("deleted_at", null)
        .eq("is_active", true)
        .maybeSingle();
      setAwardDetail((awardData as AwardDetail) ?? null);

      if (merged.mt10id) {
        const { data: facilityData } = await supabase
          .from("kopis_facility_details")
          .select(
            "mt10id,adres,telno,relateurl,parkinglot,restaurant,cafe,store,nolibang,suyu,parkbarrier,restbarrier,runwbarrier,elevbarrier",
          )
          .eq("mt10id", merged.mt10id)
          .is("deleted_at", null)
          .eq("is_active", true)
          .maybeSingle();
        setFacilityDetail((facilityData as FacilityDetail) ?? null);
      } else {
        setFacilityDetail(null);
      }

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
    setReviewReportCounts({});
    setFacilityDetail(null);
    setAwardDetail(null);
    setInfoTab("performance");
    setHasMoreReviews(true);
    setReviewPage(1);
    setOrderedReviewIds([]);
    setReviewOrderReady(false);
    setActiveVisualIndex(0);
    requestedPagesRef.current = new Set();
  }, [performanceId]);

  useEffect(() => {
    const fetchReviewOrder = async () => {
      setReviewOrderReady(false);
      const { data: reviewRows, error: reviewError } = await supabase
        .from("performance_reviews")
        .select("id,created_at")
        .eq("performance_id", performanceId)
        .is("deleted_at", null);

      if (reviewError) {
        toast("리뷰를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setOrderedReviewIds([]);
        setHasMoreReviews(false);
        setReviewOrderReady(true);
        return;
      }

      const rows = (reviewRows ?? []) as Array<{ id: string; created_at: string }>;
      if (rows.length === 0) {
        setOrderedReviewIds([]);
        setHasMoreReviews(false);
        setReviewOrderReady(true);
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
      if (!reviewOrderReady || reviewPage === 0 || !hasMoreReviews) return;
      if (requestedPagesRef.current.has(reviewPage)) return;
      requestedPagesRef.current.add(reviewPage);
      setLoadingReviews(true);

      const from = (reviewPage - 1) * REVIEW_PAGE_SIZE;
      const to = from + REVIEW_PAGE_SIZE - 1;
      const pageReviewIds = orderedReviewIds.slice(from, to + 1);
      if (pageReviewIds.length === 0) {
        setHasMoreReviews(false);
        setLoadingReviews(false);
        return;
      }
      const { data, error } = await supabase
        .from("performance_reviews")
        .select("id,rating,content,created_at,user_id")
        .in("id", pageReviewIds)
        .is("deleted_at", null);

      if (error) {
        toast("리뷰를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setLoadingReviews(false);
        return;
      }

      const fetchedRows = (data as ReviewItem[]) ?? [];
      const reviewMap = new Map(fetchedRows.map((row) => [row.id, row]));
      const nextRows = pageReviewIds
        .map((reviewId) => reviewMap.get(reviewId))
        .filter((row): row is ReviewItem => Boolean(row));
      setReviews((prev) => {
        const merged = [...prev, ...nextRows];
        const seen = new Set<string>();
        return merged.filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      });
      if (to >= orderedReviewIds.length - 1) {
        setHasMoreReviews(false);
      }

      const reviewIds = nextRows.map((row) => row.id);
      const userIds = Array.from(new Set(nextRows.map((row) => row.user_id)));

      if (reviewIds.length > 0) {
        const [
          profileRows,
          { data: likeRows },
          { data: commentRows },
          { data: imageRows },
          { data: likedRows },
          { data: reportRows },
        ] = await Promise.all([
          fetchPublicProfiles(userIds),
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
            .is("deleted_at", null),
          user
            ? supabase
                .from("performance_review_likes")
                .select("review_id")
                .eq("user_id", user.id)
                .in("review_id", reviewIds)
                .is("deleted_at", null)
            : Promise.resolve({ data: [] }),
          supabase
            .from("performance_review_reports")
            .select("review_id")
            .in("review_id", reviewIds)
            .is("deleted_at", null),
        ]);

        setProfiles((prev) => ({ ...prev, ...(profileRows ?? {}) }));

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

        const nextReportCounts: Record<string, number> = {};
        (reportRows ?? []).forEach((row) => {
          nextReportCounts[row.review_id] =
            (nextReportCounts[row.review_id] ?? 0) + 1;
        });
        setReviewReportCounts((prev) => ({ ...prev, ...nextReportCounts }));
      }

      setLoadingReviews(false);
    };

    fetchReviewsPage();
  }, [
    reviewPage,
    hasMoreReviews,
    user,
    orderedReviewIds,
    reviewOrderReady,
  ]);

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

    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) return;
    const res = await fetch(`/api/reviews/${reviewId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
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
    setReviewReportCounts((prev) => {
      const next = { ...prev };
      delete next[deleteTargetId];
      return next;
    });
    await refreshReviewSummary();
    setDeleteTargetId(null);
  };

  const openReviewReportSheet = (targetId: string) => {
    setReportTargetId(targetId);
    setReportReason("SPAM");
    setReportDetail("");
    setReportSheetOpen(true);
  };

  const handleSubmitReviewReport = async () => {
    if (!reportTargetId) return;
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) return;

    setReporting(true);
    const response = await fetch(`/api/reviews/${reportTargetId}/report`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason_code: reportReason,
        reason_detail: reportDetail.trim() || null,
      }),
    });

    if (!response.ok) {
      toast("신고를 접수하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setReporting(false);
      return;
    }

    const payload = (await response.json()) as { report_count?: number };
    const reportCount = payload.report_count ?? 0;

    setReviewReportCounts((prev) => ({
      ...prev,
      [reportTargetId]: reportCount,
    }));
    setReviews((prev) =>
      prev.map((item) =>
        item.id === reportTargetId ? { ...item, report_count: reportCount } : item
      )
    );

    setReporting(false);
    setReportSheetOpen(false);
    setReportTargetId(null);
    toast("신고가 접수되었어요.");
  };

  const awardLines = useMemo(() => {
    const raw = awardDetail?.awards;
    if (!raw) return [];
    return raw
      .replace(/&lt;br\s*\/?&gt;/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [awardDetail?.awards]);

  const visualSlides = useMemo(() => {
    if (!detail) return [];
    const slides: Array<{ id: string; url: string; alt: string }> = [];
    if (detail.poster) {
      slides.push({
        id: `${detail.mt20id}-poster`,
        url: detail.poster,
        alt: `${detail.prfnm ?? "공연"} 포스터`,
      });
    }
    (detail.styurls ?? []).forEach((url, index) => {
      if (!url) return;
      slides.push({
        id: `${detail.mt20id}-sty-${index}`,
        url,
        alt: `${detail.prfnm ?? "공연"} 소개 이미지 ${index + 1}`,
      });
    });
    return slides;
  }, [detail]);

  const sharedVisualBackgroundUrl = useMemo(() => {
    if (!detail) return null;
    return detail.poster ?? detail.styurls?.[0] ?? null;
  }, [detail]);

  useEffect(() => {
    if (!visualApi) return;

    const onSelect = () => {
      setActiveVisualIndex(visualApi.selectedScrollSnap());
    };

    onSelect();
    visualApi.on("select", onSelect);
    visualApi.on("reInit", onSelect);

    return () => {
      visualApi.off("select", onSelect);
      visualApi.off("reInit", onSelect);
    };
  }, [visualApi]);

  return (
    <MobileContainer>
      <main className="pb-12">
        {loading ? (
          <div className="space-y-5">
            <section className="relative h-[400px] w-full overflow-hidden bg-black/5">
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
            <section className="relative h-[400px] w-full overflow-hidden bg-black">
              {visualSlides.length ? (
                <>
                  <Carousel
                    setApi={setVisualApi}
                    opts={{ align: "start" }}
                    className="absolute inset-0 z-0"
                  >
                    <CarouselContent className="h-full">
                      {visualSlides.map((slide) => (
                        <CarouselItem key={slide.id} className="h-full">
                          <button
                            type="button"
                            className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black"
                            onClick={() => {
                              setViewerUrl(slide.url);
                              setViewerOpen(true);
                            }}
                            aria-label="공연 이미지 크게 보기"
                          >
                            {sharedVisualBackgroundUrl ? (
                              <FadeInImage
                                src={sharedVisualBackgroundUrl}
                                alt=""
                                className="absolute inset-0 h-full w-full scale-110 object-cover blur-3xl opacity-75"
                              />
                            ) : null}
                            <div className="absolute inset-0 bg-black/30" />
                            <div className="absolute inset-0 z-10 flex items-center justify-center">
                              <FadeInImage
                                src={slide.url}
                                alt={slide.alt}
                                className="block max-h-full max-w-full object-contain object-center"
                              />
                            </div>
                          </button>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                  <div className="absolute right-4 bottom-4 z-10 rounded-full bg-black/45 px-2.5 py-1 text-xs text-white">
                    {Math.min(activeVisualIndex + 1, visualSlides.length)} /{" "}
                    {visualSlides.length}
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
                  포스터 이미지 없음
                </div>
              )}
              <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/40 to-transparent px-4 pt-2 pb-12">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="text-white hover:bg-white/10"
                  onClick={() => router.back()}
                  aria-label="뒤로"
                >
                  <ChevronLeft className="size-6" />
                </Button>
                <div className="w-9" />
              </header>
            </section>

            <div className="space-y-5 px-4 pb-2">
              <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
                <h1 className="text-lg font-semibold leading-snug text-[#17171c]">
                  {detail.prfnm || "공연명 미정"}
                </h1>
                <div className="mt-2 flex flex-col gap-0.5 text-sm text-[#17171c]/70">
                  <span>{formatDateRange(detail.prfpdfrom, detail.prfpdto)}</span>
                  <span>{formatOrFallback(detail.fcltynm, "공연장 정보 없음")}</span>
                </div>
                {reviewAverage !== null ? (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-[#17171c]/70">
                    {Array.from({ length: 5 }, (_, index) => {
                      const ratio = getStarFillRatio(reviewAverage, index + 1);
                      return (
                        <div
                          key={`summary-star-${index}`}
                          className="relative h-4 w-4"
                        >
                          <Star className="h-4 w-4 text-[#ff273d]" fill="none" />
                          <div
                            className="absolute inset-0 overflow-hidden"
                            style={{ width: `${ratio * 100}%` }}
                          >
                            <Star className="h-4 w-4 text-[#ff273d]" fill="#ff273d" />
                          </div>
                        </div>
                      );
                    })}
                    <span className="text-[#ff273d]">
                      {formatRatingText(reviewAverage)}점
                    </span>
                  </div>
                ) : null}
                {awardLines.length ? (
                  <div className="mt-3 space-y-1">
                    <ul className="space-y-1">
                      {awardLines.map((line, index) => (
                        <li
                          key={`${detail.mt20id}-award-${index}`}
                          className="flex items-start gap-1.5 text-xs leading-relaxed text-[#17171c]"
                        >
                          <Trophy className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
              <section className="space-y-4 rounded-2xl border border-black/5 bg-white p-5 text-xs text-[#17171c] shadow-sm">
                <div className="flex w-full">
                  <div className="relative flex w-full rounded-xl bg-black/5 p-1.5 text-xs text-[#17171c]/60">
                    <div
                      className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-all duration-200 ease-out"
                      style={{
                        left: infoTab === "facility" ? "calc(50% + 2px)" : "4px",
                        width: "calc(50% - 6px)",
                      }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      className={`relative z-10 flex-1 min-w-0 rounded-lg py-2.5 transition-colors duration-200 ${
                        infoTab === "performance" ? "text-[#17171c]" : "text-[#17171c]/60"
                      }`}
                      onClick={() => {
                        sendHapticToApp();
                        setInfoTab("performance");
                      }}
                    >
                      공연 정보
                    </button>
                    <button
                      type="button"
                      className={`relative z-10 flex-1 min-w-0 rounded-lg py-2.5 transition-colors duration-200 ${
                        infoTab === "facility" ? "text-[#17171c]" : "text-[#17171c]/60"
                      }`}
                      onClick={() => {
                        sendHapticToApp();
                        setInfoTab("facility");
                      }}
                    >
                      공연 시설 정보
                    </button>
                  </div>
                </div>
                {infoTab === "performance" ? (
                  <>
                    {(() => {
                      const perfItems = [
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
                        .filter((item) => item.value);

                      if (!perfItems.length) {
                        return (
                          <p className="text-xs text-[#17171c]/50">
                            정보 없음
                          </p>
                        );
                      }

                      return (
                        <Table>
                          <TableBody className="text-[#17171c]/70 text-xs">
                            {perfItems.map((item) => (
                            <TableRow
                              key={item.label}
                              className="border-black/5 hover:bg-transparent"
                            >
                              <TableCell className="text-[#17171c]/50 py-2.5">
                                {item.label}
                              </TableCell>
                              <TableCell className="whitespace-normal break-words py-2.5">
                                {item.value}
                              </TableCell>
                            </TableRow>
                          ))}
                          </TableBody>
                        </Table>
                      );
                    })()}
                    {formatOptionalText(detail.sty) ? (
                      <>
                        <Separator className="my-4 bg-black/5" />
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-[#17171c]">줄거리</h4>
                          <p
                            className={`whitespace-pre-line text-xs leading-relaxed text-[#17171c]/70 ${
                              storyExpanded ? "" : "line-clamp-3"
                            }`}
                          >
                            {formatOptionalText(detail.sty)}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-1 w-full text-xs text-[#17171c]/60"
                            onClick={() => setStoryExpanded((prev) => !prev)}
                          >
                            {storyExpanded ? "접기" : "더보기"}
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </>
                ) : (
                  (() => {
                    const facilityUrl = formatOptionalText(
                      facilityDetail?.relateurl,
                    );
                    const facilityUrlHref =
                      facilityUrl && facilityUrl.startsWith("http")
                        ? facilityUrl
                        : facilityUrl
                          ? `https://${facilityUrl}`
                          : null;
                    const items = [
                      {
                        label: "주소",
                        value: formatOptionalText(facilityDetail?.adres),
                      },
                      {
                        label: "전화번호",
                        value: formatOptionalText(facilityDetail?.telno),
                      },
                      {
                        label: "홈페이지",
                        value: facilityUrlHref ? (
                          <a
                            href={facilityUrlHref}
                            target="_blank"
                            rel="noreferrer"
                            className="break-words text-[#17171c] underline underline-offset-2"
                          >
                            {facilityUrl}
                          </a>
                        ) : null,
                      },
                      {
                        label: "주차장",
                        value: toYesLabel(facilityDetail?.parkinglot),
                      },
                      {
                        label: "레스토랑",
                        value: toYesLabel(facilityDetail?.restaurant),
                      },
                      {
                        label: "카페",
                        value: toYesLabel(facilityDetail?.cafe),
                      },
                      {
                        label: "편의점",
                        value: toYesLabel(facilityDetail?.store),
                      },
                      {
                        label: "놀이방",
                        value: toYesLabel(facilityDetail?.nolibang),
                      },
                      {
                        label: "수유실",
                        value: toYesLabel(facilityDetail?.suyu),
                      },
                      {
                        label: "장애시설-주차장",
                        value: toYesLabel(facilityDetail?.parkbarrier),
                      },
                      {
                        label: "장애시설-화장실",
                        value: toYesLabel(facilityDetail?.restbarrier),
                      },
                      {
                        label: "장애시설-경사로",
                        value: toYesLabel(facilityDetail?.runwbarrier),
                      },
                      {
                        label: "장애시설-엘리베이터",
                        value: toYesLabel(facilityDetail?.elevbarrier),
                      },
                    ].filter((item) => item.value);

                    if (!items.length) {
                      return (
                        <p className="text-xs text-[#17171c]/50">
                          정보 없음
                        </p>
                      );
                    }

                    return (
                      <Table>
                        <TableBody className="text-[#17171c]/70 text-xs">
                          {items.map((item) => (
                            <TableRow
                              key={item.label}
                              className="border-black/5 hover:bg-transparent"
                            >
                              <TableCell className="text-[#17171c]/50 py-2.5">
                                {item.label}
                              </TableCell>
                              <TableCell className="whitespace-normal break-words py-2.5">
                                {item.label === "주소" &&
                                typeof item.value === "string" ? (
                                  <span className="inline-flex items-center gap-2">
                                    <span className="min-w-0 flex-1 break-words">
                                      {item.value}
                                    </span>
                                    <button
                                      type="button"
                                      className="shrink-0 rounded p-1 text-[#17171c]/50 hover:bg-black/5 hover:text-[#17171c]"
                                      onClick={() => {
                                        navigator.clipboard
                                          .writeText(item.value as string)
                                          .then(() =>
                                            toast("주소가 복사되었어요.")
                                          )
                                          .catch(() =>
                                            toast("복사에 실패했어요.")
                                          );
                                      }}
                                      aria-label="주소 복사"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </button>
                                  </span>
                                ) : (
                                  item.value
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    );
                  })()
                )}
              </section>

              <section className="space-y-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#17171c]">리뷰</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 rounded-lg p-0 text-[#17171c]/70 hover:bg-black/5"
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
                      <span className="text-[#ff273d]">평균</span>
                      <span className="inline-flex items-center gap-1 font-medium text-[#ff273d]">
                        <Star className="h-4 w-4 text-[#ff273d]" fill="#ff273d" />
                        {formatRatingText(reviewAverage)}점
                      </span>
                      <span className="text-[#17171c]/40">/</span>
                      <span>총 리뷰 수 {reviewCount}개</span>
                    </div>
                  ) : (
                    <span className="text-[#17171c]/60">아직 리뷰가 없어요. 첫 리뷰를 남겨 보세요.</span>
                  )}
                </div>
                <div className="space-y-4">
                  {reviews.length === 0 && !loadingReviews ? null : (
                    reviews.map((review) => {
                      const profile = profiles[review.user_id];
                      const isMyReview = user?.id === review.user_id;
                      const isReviewHidden =
                        (reviewReportCounts[review.id] ?? review.report_count ?? 0) >=
                        REPORT_THRESHOLD;
                      return (
                        <div
                          key={review.id}
                          className="rounded-xl border border-black/5 bg-black/[0.02] p-3 text-sm text-[#17171c] transition-colors active:bg-black/5"
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
                          <div className="flex items-center justify-between gap-2 text-xs text-[#17171c]/60">
                            <span>
                              {getDisplayNickname(profile?.nickname, review.user_id)} ·{" "}
                              {formatDate(review.created_at)}
                            </span>
                            {user ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-[#17171c]/60"
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
                                  {isMyReview ? (
                                    <>
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
                                    </>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="w-full justify-start text-sm"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openReviewReportSheet(review.id);
                                      }}
                                    >
                                      <Flag className="mr-2 h-4 w-4" />
                                      신고하기
                                    </Button>
                                  )}
                                </PopoverContent>
                              </Popover>
                            ) : null}
                          </div>
                          <div className="mt-2.5 flex items-center gap-1">
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
                          <p className="mt-2.5 whitespace-pre-line text-sm text-[#17171c]">
                            {isReviewHidden
                              ? "신고로 인해 숨김 처리되었어요."
                              : review.content || "내용이 없어요."}
                          </p>
                          {!isReviewHidden && reviewImages[review.id]?.length ? (
                            <div className="mt-2.5 flex gap-2">
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
                          <div className="mt-2.5 flex items-center gap-4 text-xs text-[#17171c]">
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
                    <div className="space-y-4">
                      {Array.from({ length: 2 }).map((_, index) => (
                        <div
                          key={`loading-review-${index}`}
                          className="rounded-xl border border-black/5 bg-black/[0.02] p-4"
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
      <BottomSheet
        open={reportSheetOpen}
        onOpenChange={(open) => {
          setReportSheetOpen(open);
          if (!open) {
            setReportTargetId(null);
          }
        }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {REPORT_REASON_OPTIONS.map((option) => {
              const selected = reportReason === option.code;
              return (
                <button
                  key={option.code}
                  type="button"
                  className={`flex h-14 w-full items-center justify-between rounded-lg border px-3 text-left text-sm transition ${
                    selected
                      ? "border-[#17171c]/40 bg-black/5 text-[#17171c]"
                      : "border-black/10 text-[#17171c]/80"
                  }`}
                  onClick={() => setReportReason(option.code)}
                >
                  <span>{option.label}</span>
                  {selected ? (
                    <span className="text-xs text-[#17171c]/60">선택됨</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <textarea
              value={reportDetail}
              onChange={(event) => setReportDetail(event.target.value)}
              className="min-h-[120px] w-full rounded-md border border-black/10 bg-white px-3 py-2 text-base text-[#17171c] placeholder:text-xs focus:outline-none"
              maxLength={400}
              placeholder="추가로 전달할 내용을 입력해 주세요. (선택사항)"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1"
              onClick={() => setReportSheetOpen(false)}
              disabled={reporting}
            >
              취소
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 bg-[#17171c] text-white hover:bg-[#17171c]/90"
              onClick={handleSubmitReviewReport}
              disabled={reporting}
            >
              {reporting ? "제출 중..." : "제출하기"}
            </Button>
          </div>
        </div>
      </BottomSheet>
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
