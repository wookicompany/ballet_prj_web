"use client";

import { useEffect, useRef, useState } from "react";
import AdsenseSlot from "@/components/ads/AdsenseSlot";
import AnimatedImage from "@/components/ui/animated-image";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import ImageViewer from "@/components/ui/image-viewer";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getAccessToken } from "@/lib/authSession";
import { formatCareerDuration, formatIsoToSeoulDate } from "@/lib/kstDateTime";
import { getProfileCache, setProfileCache } from "@/lib/profileCache";
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

type RecordSummary = {
  id: string;
  recordDate: string;
  startTime: string;
  endTime: string;
  content: string;
  mood: number | null;
  createdAt: string;
};

type ProfileCachePayload = {
  profile: Profile | null;
  recordCount: number;
  totalMinutes: number;
  reviewCount: number;
  reviews: ReviewSummary[];
  records: RecordSummary[];
  recordMediaById: Record<string, { urls: string[]; count: number }>;
  reviewLikeCounts: Record<string, number>;
  reviewCommentCounts: Record<string, number>;
  reviewImages: Record<string, string[]>;
  reviewPage: number;
  hasMoreReviews: boolean;
  recordPage: number;
  hasMoreRecords: boolean;
  orderedReviewIds: string[];
  orderedRecordIds: string[];
  activeTab: "records" | "reviews";
};

const REVIEW_PAGE_SIZE_INITIAL = 5;
const REVIEW_PAGE_SIZE_MORE = 12;
const RECORD_PAGE_SIZE_INITIAL = 5;
const RECORD_PAGE_SIZE_MORE = 12;
const PROFILE_HOME_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_PROFILE_HOME;

function toMinutes(time: string) {
  const [hh, mm, ss] = time.split(":").map((value) => Number(value));
  return hh * 60 + mm + (ss ? Math.round(ss / 60) : 0);
}

const formatReviewDate = (value: string) => {
  return formatIsoToSeoulDate(value, "ko-KR");
};

const formatRecordDate = (value: string) => {
  return formatIsoToSeoulDate(value, "ko-KR");
};

const formatRecordTimeRange = (startTime: string, endTime: string) => {
  const start = startTime.slice(0, 5);
  const end = endTime.slice(0, 5);
  return `${start} - ${end}`;
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

  const profileCached = user && !loading ? getProfileCache<ProfileCachePayload>(user.id) : null;

  const [profile, setProfile] = useState<Profile | null>(() => profileCached?.profile ?? null);
  const [recordCount, setRecordCount] = useState(() => profileCached?.recordCount ?? 0);
  const [totalMinutes, setTotalMinutes] = useState(() => profileCached?.totalMinutes ?? 0);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [reviewCount, setReviewCount] = useState(() => profileCached?.reviewCount ?? 0);
  const [reviews, setReviews] = useState<ReviewSummary[]>(() => profileCached?.reviews ?? []);
  const [records, setRecords] = useState<RecordSummary[]>(() => profileCached?.records ?? []);
  const [recordMediaById, setRecordMediaById] = useState<Record<string, { urls: string[]; count: number }>>(() => profileCached?.recordMediaById ?? {});
  const [reviewLikeCounts, setReviewLikeCounts] = useState<Record<string, number>>(() => profileCached?.reviewLikeCounts ?? {});
  const [reviewCommentCounts, setReviewCommentCounts] = useState<Record<string, number>>(() => profileCached?.reviewCommentCounts ?? {});
  const [reviewImages, setReviewImages] = useState<Record<string, string[]>>(() => profileCached?.reviewImages ?? {});
  const [reviewPage, setReviewPage] = useState(() => profileCached?.reviewPage ?? 0);
  const [hasMoreReviews, setHasMoreReviews] = useState(() => profileCached?.hasMoreReviews ?? true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showMoreReviews, setShowMoreReviews] = useState(false);
  const [orderedReviewIds, setOrderedReviewIds] = useState<string[]>(() => profileCached?.orderedReviewIds ?? []);
  const [reviewOrderReady, setReviewOrderReady] = useState(() => !!profileCached);
  const [reviewSectionLoading, setReviewSectionLoading] = useState(() => !profileCached);
  const [recordPage, setRecordPage] = useState(() => profileCached?.recordPage ?? 0);
  const [hasMoreRecords, setHasMoreRecords] = useState(() => profileCached?.hasMoreRecords ?? true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [showMoreRecords, setShowMoreRecords] = useState(false);
  const [orderedRecordIds, setOrderedRecordIds] = useState<string[]>(() => profileCached?.orderedRecordIds ?? []);
  const [recordOrderReady, setRecordOrderReady] = useState(() => !!profileCached);
  const [recordSectionLoading, setRecordSectionLoading] = useState(() => !profileCached);
  const [activeTab, setActiveTab] = useState<"records" | "reviews">(() => profileCached?.activeTab ?? "records");
  const [profileLoading, setProfileLoading] = useState(() => !profileCached);
  const [hasUnreadNotices, setHasUnreadNotices] = useState(false);

  const cardSentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedPagesRef = useRef<Set<number>>(
    profileCached
      ? new Set(Array.from({ length: profileCached.reviewPage }, (_, i) => i + 1))
      : new Set()
  );
  const requestedRecordPagesRef = useRef<Set<number>>(
    profileCached
      ? new Set(Array.from({ length: profileCached.recordPage }, (_, i) => i + 1))
      : new Set()
  );
  const loadingReviewsRef = useRef(loadingReviews);
  const loadingRecordsRef = useRef(loadingRecords);

  useEffect(() => {
    const controller = new AbortController();

    const fetchNoticeReadStatus = async () => {
      if (loading) return;
      if (pathname !== "/profile") return;
      if (!user) {
        setHasUnreadNotices(false);
        return;
      }

      const accessToken = await getAccessToken(openLoginSheet);
      if (!accessToken) {
        setHasUnreadNotices(false);
        return;
      }

      try {
        const response = await fetch("/api/notices/read-status", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          setHasUnreadNotices(false);
          return;
        }

        const payload = (await response.json()) as { has_unread?: boolean };
        setHasUnreadNotices(payload.has_unread === true);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setHasUnreadNotices(false);
      }
    };

    void fetchNoticeReadStatus();
    return () => {
      controller.abort();
    };
  }, [user, pathname, loading, openLoginSheet]);

  // fetchProfile + fetchReviewOrder + fetchRecordOrder를 1개 effect로 통합
  // React 렌더 사이클 지연 2회 제거
  useEffect(() => {
    const fetchAll = async () => {
      if (loading || pathname !== "/profile") return;
      if (!user) {
        openLoginSheet();
        return;
      }

      if (getProfileCache<ProfileCachePayload>(user.id)) return;

      setProfileLoading(true);
      setReviewSectionLoading(true);
      setRecordSectionLoading(true);

      // Step 1: user_id만 필요한 쿼리 3개 병렬 실행
      const [profileRes, recordStatsRes, reviewCountRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,nickname,avatar_url,ballet_started_at")
          .eq("id", user.id)
          .single(),
        supabase
          .from("records")
          .select("start_time,end_time")
          .eq("user_id", user.id)
          .is("deleted_at", null),
        supabase
          .from("performance_reviews")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("deleted_at", null),
      ]);

      if (!profileRes.data) {
        await supabase.from("profiles").insert({ id: user.id });
        setProfile({ id: user.id, nickname: null, avatar_url: null, ballet_started_at: null });
      } else {
        setProfile(profileRes.data as Profile);
      }

      const recordStatsLocal = recordStatsRes.data ?? [];
      setRecordCount(recordStatsLocal.length);
      setTotalMinutes(
        recordStatsLocal.reduce(
          (sum, record) => sum + (toMinutes(record.end_time) - toMinutes(record.start_time)),
          0
        )
      );

      const reviewCountLocal = reviewCountRes.count ?? 0;
      setReviewCount(reviewCountLocal);

      // 페이지네이션 상태 초기화
      setReviews([]);
      setReviewLikeCounts({});
      setReviewCommentCounts({});
      setReviewImages({});
      setRecordMediaById({});
      setRecords([]);
      setOrderedReviewIds([]);
      setOrderedRecordIds([]);
      setReviewOrderReady(false);
      setRecordOrderReady(false);
      setShowMoreRecords(false);
      setShowMoreReviews(false);
      setRecordPage(recordStatsLocal.length === 0 ? 0 : 1);
      setReviewPage(reviewCountLocal === 0 ? 0 : 1);
      requestedPagesRef.current = new Set();
      requestedRecordPagesRef.current = new Set();

      if (recordStatsLocal.length === 0) {
        setHasMoreRecords(false);
        setRecordOrderReady(true);
        setRecordSectionLoading(false);
      } else {
        setHasMoreRecords(true);
      }
      if (reviewCountLocal === 0) {
        setHasMoreReviews(false);
        setReviewOrderReady(true);
        setReviewSectionLoading(false);
      } else {
        setHasMoreReviews(true);
      }

      setProfileLoading(false);

      // Step 2: 리뷰 순서 + 기록 순서 병렬 조회 (React 사이클 없이 직접 실행)
      const [reviewOrderRes, recordOrderRes] = await Promise.all([
        reviewCountLocal > 0
          ? supabase
              .from("performance_reviews")
              .select("id,created_at")
              .eq("user_id", user.id)
              .is("deleted_at", null)
          : Promise.resolve({ data: [] as Array<{ id: string; created_at: string }>, error: null }),
        recordStatsLocal.length > 0
          ? supabase
              .from("records")
              .select("id,record_date,created_at")
              .eq("user_id", user.id)
              .is("deleted_at", null)
              .order("record_date", { ascending: false })
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as Array<{ id: string }>, error: null }),
      ]);

      // 기록 순서 처리
      const recordOrderRows = (recordOrderRes.data ?? []) as Array<{ id: string }>;
      if (recordOrderRes.error || recordOrderRows.length === 0) {
        setOrderedRecordIds([]);
        setHasMoreRecords(false);
        setRecordOrderReady(true);
        setRecordSectionLoading(false);
      } else {
        setOrderedRecordIds(recordOrderRows.map((row) => row.id));
        setHasMoreRecords(true);
        setRecordOrderReady(true);
      }

      // 리뷰 순서 처리
      const reviewOrderRows = (reviewOrderRes.data ?? []) as Array<{ id: string; created_at: string }>;
      if (reviewOrderRes.error || reviewOrderRows.length === 0) {
        setOrderedReviewIds([]);
        setHasMoreReviews(false);
        setReviewOrderReady(true);
        setReviewSectionLoading(false);
        return;
      }

      // Step 3: 리뷰 정렬용 좋아요+댓글 수 (reviewIds에 의존)
      const reviewIds = reviewOrderRows.map((row) => row.id);
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
        likeCountByReviewId[row.review_id] = (likeCountByReviewId[row.review_id] ?? 0) + 1;
      });
      const commentCountByReviewId: Record<string, number> = {};
      (commentRows ?? []).forEach((row) => {
        commentCountByReviewId[row.review_id] = (commentCountByReviewId[row.review_id] ?? 0) + 1;
      });

      const sorted = [...reviewOrderRows].sort((a, b) => {
        const scoreA = (likeCountByReviewId[a.id] ?? 0) + (commentCountByReviewId[a.id] ?? 0);
        const scoreB = (likeCountByReviewId[b.id] ?? 0) + (commentCountByReviewId[b.id] ?? 0);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setOrderedReviewIds(sorted.map((row) => row.id));
      setHasMoreReviews(true);
      setReviewOrderReady(true);
    };

    fetchAll();
  }, [user, loading, pathname, openLoginSheet]);

  useEffect(() => { loadingReviewsRef.current = loadingReviews; }, [loadingReviews]);
  useEffect(() => { loadingRecordsRef.current = loadingRecords; }, [loadingRecords]);

  useEffect(() => {
    if (!user || profileLoading || !reviewOrderReady || !recordOrderReady) return;
    setProfileCache<ProfileCachePayload>(user.id, {
      profile,
      recordCount,
      totalMinutes,
      reviewCount,
      reviews,
      records,
      recordMediaById,
      reviewLikeCounts,
      reviewCommentCounts,
      reviewImages,
      reviewPage,
      hasMoreReviews,
      recordPage,
      hasMoreRecords,
      orderedReviewIds,
      orderedRecordIds,
      activeTab,
    });
  }, [
    user, profile, recordCount, totalMinutes, reviewCount, reviews, records,
    recordMediaById, reviewLikeCounts, reviewCommentCounts, reviewImages,
    reviewPage, hasMoreReviews, recordPage, hasMoreRecords,
    orderedReviewIds, orderedRecordIds, activeTab,
    profileLoading, reviewOrderReady, recordOrderReady,
  ]);

  useEffect(() => {
    if (!cardSentinelRef.current || (!hasMoreReviews && !hasMoreRecords)) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      if (activeTab === "reviews" && showMoreReviews && !loadingReviewsRef.current) {
        setReviewPage((prev) => prev + 1);
      } else if (activeTab !== "reviews" && showMoreRecords && !loadingRecordsRef.current) {
        setRecordPage((prev) => prev + 1);
      }
    });
    observer.observe(cardSentinelRef.current);
    return () => observer.disconnect();
  }, [activeTab, showMoreReviews, hasMoreReviews, showMoreRecords, hasMoreRecords]);

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
        const userId = user?.id;
        if (!userId) return;

        const { data: reviewRows, error } = await supabase
          .from("performance_reviews")
          .select("id,performance_id,rating,content,created_at")
          .in("id", pageReviewIds)
          .is("deleted_at", null)
          .eq("user_id", userId);

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

        const reviewIds = nextRows.map((row) => row.id);
        const performanceIds = Array.from(
          new Set(nextRows.map((row) => row.performance_id))
        );

        // Step 2: kopis_performances + likes + comments + images 4개 병렬
        const [performanceRes, likeRes, commentRes, imageRes] = await Promise.all([
          supabase
            .from("kopis_performances")
            .select("mt20id,prfnm,poster")
            .in("mt20id", performanceIds),
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
            .eq("user_id", userId)
            .is("deleted_at", null),
        ]);

        const performanceMap = new Map<
          string,
          { name: string | null; poster: string | null }
        >();
        (performanceRes.data ?? []).forEach((row) => {
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

  useEffect(() => {
    const fetchRecordsPage = async () => {
      if (!user || !recordOrderReady || recordPage === 0 || !hasMoreRecords) return;
      if (requestedRecordPagesRef.current.has(recordPage)) return;
      requestedRecordPagesRef.current.add(recordPage);
      setLoadingRecords(true);
      try {
        const pageSize = showMoreRecords
          ? RECORD_PAGE_SIZE_MORE
          : RECORD_PAGE_SIZE_INITIAL;
        const from = (recordPage - 1) * pageSize;
        const to = from + pageSize - 1;
        const pageRecordIds = orderedRecordIds.slice(from, to + 1);
        if (pageRecordIds.length === 0) {
          setHasMoreRecords(false);
          return;
        }
        const userId = user?.id;
        if (!userId) return;

        // records + record_media 병렬 조회
        const [{ data: recordRows, error }, { data: mediaRows }] = await Promise.all([
          supabase
            .from("records")
            .select("id,record_date,start_time,end_time,content,mood,created_at")
            .in("id", pageRecordIds)
            .eq("user_id", userId)
            .is("deleted_at", null),
          supabase
            .from("record_media")
            .select("record_id,url,created_at")
            .in("record_id", pageRecordIds)
            .is("deleted_at", null)
            .order("created_at", { ascending: true }),
        ]);

        if (error) {
          return;
        }

        const fetchedRows = (recordRows ?? []) as Array<{
          id: string;
          record_date: string;
          start_time: string;
          end_time: string;
          content: string;
          mood: number | null;
          created_at: string;
        }>;

        const rowMap = new Map(fetchedRows.map((row) => [row.id, row]));
        const nextRows = pageRecordIds
          .map((recordId) => rowMap.get(recordId))
          .filter(
            (
              row
            ): row is {
              id: string;
              record_date: string;
              start_time: string;
              end_time: string;
              content: string;
              mood: number | null;
              created_at: string;
            } => Boolean(row)
          );

        if (to >= orderedRecordIds.length - 1) {
          setHasMoreRecords(false);
        }

        const mapped = nextRows.map((row) => ({
          id: row.id,
          recordDate: row.record_date,
          startTime: row.start_time,
          endTime: row.end_time,
          content: row.content,
          mood: row.mood,
          createdAt: row.created_at,
        }));

        setRecords((prev) => {
          const existing = new Set(prev.map((row) => row.id));
          return [...prev, ...mapped.filter((row) => !existing.has(row.id))];
        });
        const nextMediaById: Record<string, { urls: string[]; count: number }> = {};
        (mediaRows ?? []).forEach((row) => {
          if (!nextMediaById[row.record_id]) {
            nextMediaById[row.record_id] = { urls: [row.url], count: 1 };
            return;
          }
          nextMediaById[row.record_id].count += 1;
          if (nextMediaById[row.record_id].urls.length < 3) {
            nextMediaById[row.record_id].urls.push(row.url);
          }
        });
        if (Object.keys(nextMediaById).length > 0) {
          setRecordMediaById((prev) => ({ ...prev, ...nextMediaById }));
        }
      } finally {
        setLoadingRecords(false);
        if (recordPage === 1) {
          setRecordSectionLoading(false);
        }
      }
    };

    fetchRecordsPage();
  }, [
    recordPage,
    user,
    hasMoreRecords,
    showMoreRecords,
    orderedRecordIds,
    recordOrderReady,
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
  const shouldShowRecordCardSkeleton = profileLoading || recordSectionLoading;
  const careerDuration = profile?.ballet_started_at
    ? formatCareerDuration(profile.ballet_started_at)
    : null;

  return (
    <>
      <main className="px-4 pb-[140px]">
        <header className="sticky top-0 z-20 bg-white -mx-4 px-4 h-12 mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">프로필</h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="relative text-[#17171c]/70"
            onClick={() => router.push("/profile/menu")}
            aria-label="더보기"
          >
            <Menu className="size-6" />
            {hasUnreadNotices ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FF154A]" />
            ) : null}
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
                      width={80}
                      height={80}
                      sizes="80px"
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
                className="mt-4 h-9 w-full text-xs"
                onClick={() => router.push("/profile/edit")}
              >
                프로필 편집
              </Button>
            </>
          )}
        </section>

        <section className="mt-6 space-y-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="relative inline-flex w-full rounded-lg bg-black/5 p-1">
              <div
                className="absolute bottom-1 top-1 rounded-md bg-[#17171c] transition-all duration-200 ease-out"
                style={{
                  left: activeTab === "records" ? "4px" : "calc(50% + 2px)",
                  width: "calc(50% - 6px)",
                }}
                aria-hidden
              />
              <Button
                type="button"
                className={`relative z-10 h-8 flex-1 rounded-md px-3 text-xs transition-colors duration-200 ${
                  activeTab === "records"
                    ? "bg-transparent text-white hover:bg-transparent"
                    : "bg-transparent text-[#17171c]/70 hover:bg-transparent"
                }`}
                onClick={() => setActiveTab("records")}
              >
                발레 기록
              </Button>
              <Button
                type="button"
                className={`relative z-10 h-8 flex-1 rounded-md px-3 text-xs transition-colors duration-200 ${
                  activeTab === "reviews"
                    ? "bg-transparent text-white hover:bg-transparent"
                    : "bg-transparent text-[#17171c]/70 hover:bg-transparent"
                }`}
                onClick={() => setActiveTab("reviews")}
              >
                공연 리뷰
              </Button>
            </div>
          </div>

          {activeTab === "records" ? (
            shouldShowRecordCardSkeleton ? (
              <div className="space-y-3">
                {Array.from({ length: 1 }).map((_, index) => (
                  <div
                    key={`profile-record-loading-skeleton-${index}`}
                    className="flex items-start gap-3 rounded-lg border border-black/5 bg-white p-3"
                  >
                    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : records.length === 0 ? (
              <p className="text-xs text-[#17171c]/60">
                첫번째 발레 기록을 남겨보세요.
              </p>
            ) : (
              <div className="space-y-3">
                {records.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    className="flex w-full items-start gap-3 rounded-lg border border-black/5 bg-white p-3 text-left text-sm"
                    onClick={() => {
                      sendHapticToApp();
                      router.push(`/record/${record.id}`);
                    }}
                    aria-label="기록 상세 보기"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                      {record.mood ? (
                        <AnimatedImage
                          src={`/mood/mood_dark_face_${record.mood}.png`}
                          alt={`기분 ${record.mood}단계`}
                          width={1600}
                          height={1600}
                          unoptimized
                          draggable={false}
                          className="h-10 w-10 object-contain"
                        />
                      ) : (
                        <User className="h-5 w-5 text-[#17171c]/45" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 flex-1 text-sm text-[#17171c]">
                          {record.content || "오늘의 발레를 한 줄로 남겨주세요."}
                        </p>
                        <p className="shrink-0 text-right text-xs text-[#17171c]/60">
                          {formatRecordDate(record.recordDate)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-[#17171c]/60">
                        {formatRecordTimeRange(record.startTime, record.endTime)}
                      </p>
                      {recordMediaById[record.id] ? (
                        <div className="mt-2 flex gap-1.5">
                          {recordMediaById[record.id].urls.map((url, idx) => {
                            const isLast = idx === recordMediaById[record.id].urls.length - 1;
                            const remaining = recordMediaById[record.id].count - recordMediaById[record.id].urls.length;
                            return (
                              <div key={url} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-black/5">
                                <AnimatedImage
                                  src={url}
                                  alt="기록 미디어"
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
                    </div>
                  </button>
                ))}
                {!showMoreRecords && recordCount > RECORD_PAGE_SIZE_INITIAL ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full text-xs"
                    onClick={() => {
                      setRecordSectionLoading(true);
                      setShowMoreRecords(true);
                      setRecords([]);
                      setHasMoreRecords(true);
                      setRecordPage(1);
                      requestedRecordPagesRef.current = new Set();
                    }}
                  >
                    더 보기
                  </Button>
                ) : null}
                {loadingRecords ? (
                  <div className="flex justify-center py-2">
                    <Spinner size="sm" />
                  </div>
                ) : null}
                <div ref={cardSentinelRef} />
              </div>
            )
          ) : shouldShowReviewCardSkeleton ? (
            <div className="space-y-3">
              {Array.from({ length: 1 }).map((_, index) => (
                <div
                  key={`profile-review-loading-skeleton-${index}`}
                  className="flex flex-col gap-3 rounded-lg border border-black/5 bg-white p-3"
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
            <p className="text-xs text-[#17171c]/60">
              첫번째 공연 리뷰를 남겨보세요.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <button
                  key={review.id}
                  type="button"
                  className="flex w-full flex-col rounded-lg border border-black/5 bg-white p-3 text-left text-sm"
                  onClick={() => {
                    sendHapticToApp();
                    router.push(
                      `/performance/${review.performanceId}/reviews/${review.id}`
                    );
                  }}
                  aria-label="리뷰 상세 보기"
                >
                  <div className="flex w-full items-start gap-3">
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-black/5 bg-black/5">
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
                            <div
                              key={`${review.id}-star-${index}`}
                              className="relative h-4 w-4"
                            >
                              <Star className="h-4 w-4 text-brand" fill="none" />
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
                        <p className="mt-2 line-clamp-1 text-sm text-[#17171c]/70">
                          {review.content}
                        </p>
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
                          <div key={url} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-black/5">
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
              {!showMoreReviews && reviewCount > REVIEW_PAGE_SIZE_INITIAL ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full text-xs"
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
              <div ref={cardSentinelRef} />
            </div>
          )}
        </section>

      </main>
      <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] left-1/2 z-10 w-full max-w-[430px] -translate-x-1/2 px-4">
        <AdsenseSlot placement="profile_home" slot={PROFILE_HOME_SLOT} />
      </div>
      <ImageViewer
        isOpen={avatarOpen}
        imageUrl={profile?.avatar_url ?? null}
        alt="프로필 이미지 크게 보기"
        onClose={() => setAvatarOpen(false)}
      />
    </>
  );
}
