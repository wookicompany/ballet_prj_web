"use client";

import { useEffect, useState } from "react";
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
import { Bell, ChevronRight, Heart, MessageCircle, Settings, Star, User } from "lucide-react";

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

type LikedBrand = {
  brand_id: string;
  name_ko: string;
  name_en: string | null;
  logo_url: string | null;
};

type ProfileCachePayload = {
  profile: Profile | null;
  recordCount: number;
  totalMinutes: number;
  reviewCount: number;
  recordsPreview: RecordSummary[];
  recordMediaById: Record<string, { urls: string[]; count: number }>;
  reviewsPreview: ReviewSummary[];
  reviewLikeCounts: Record<string, number>;
  reviewCommentCounts: Record<string, number>;
  reviewImages: Record<string, string[]>;
  likedBrandsPreview: LikedBrand[];
};


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
  const [recordsPreview, setRecordsPreview] = useState<RecordSummary[]>(() => profileCached?.recordsPreview ?? []);
  const [recordMediaById, setRecordMediaById] = useState<Record<string, { urls: string[]; count: number }>>(() => profileCached?.recordMediaById ?? {});
  const [reviewsPreview, setReviewsPreview] = useState<ReviewSummary[]>(() => profileCached?.reviewsPreview ?? []);
  const [reviewLikeCounts, setReviewLikeCounts] = useState<Record<string, number>>(() => profileCached?.reviewLikeCounts ?? {});
  const [reviewCommentCounts, setReviewCommentCounts] = useState<Record<string, number>>(() => profileCached?.reviewCommentCounts ?? {});
  const [reviewImages, setReviewImages] = useState<Record<string, string[]>>(() => profileCached?.reviewImages ?? {});
  const [likedBrandsPreview, setLikedBrandsPreview] = useState<LikedBrand[]>(() => profileCached?.likedBrandsPreview ?? []);
  const [profileLoading, setProfileLoading] = useState(() => !profileCached);
  const [previewLoading, setPreviewLoading] = useState(() => !profileCached);
  const [hasUnreadNotices, setHasUnreadNotices] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchBadgeStatus = async () => {
      if (loading) return;
      if (pathname !== "/profile") return;
      if (!user) {
        setHasUnreadNotices(false);
        setHasUnreadNotifications(false);
        return;
      }

      const accessToken = await getAccessToken(openLoginSheet);
      if (!accessToken) {
        setHasUnreadNotices(false);
        setHasUnreadNotifications(false);
        return;
      }

      const headers = { Authorization: `Bearer ${accessToken}` };

      try {
        const [noticesRes, notificationsRes] = await Promise.all([
          fetch("/api/notices/read-status", { headers, signal: controller.signal }),
          fetch("/api/notifications/unread-status", { headers, signal: controller.signal }),
        ]);

        if (noticesRes.ok) {
          const payload = (await noticesRes.json()) as { has_unread?: boolean };
          setHasUnreadNotices(payload.has_unread === true);
        } else {
          setHasUnreadNotices(false);
        }

        if (notificationsRes.ok) {
          const payload = (await notificationsRes.json()) as { has_unread?: boolean };
          setHasUnreadNotifications(payload.has_unread === true);
        } else {
          setHasUnreadNotifications(false);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setHasUnreadNotices(false);
        setHasUnreadNotifications(false);
      }
    };

    void fetchBadgeStatus();
    return () => {
      controller.abort();
    };
  }, [user, pathname, loading, openLoginSheet]);

  useEffect(() => {
    const fetchAll = async () => {
      if (loading || pathname !== "/profile") return;
      if (!user) {
        openLoginSheet();
        return;
      }

      if (getProfileCache<ProfileCachePayload>(user.id)) return;

      setProfileLoading(true);
      setPreviewLoading(true);

      // Step 1: profile + stats (병렬)
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
      setReviewCount(reviewCountRes.count ?? 0);
      setProfileLoading(false);

      // Step 2: 미리보기 데이터 3개씩 병렬 fetch
      const [recordsRes, reviewsRes, brandsRes] = await Promise.all([
        supabase
          .from("records")
          .select("id,record_date,start_time,end_time,content,mood,created_at")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("record_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("performance_reviews")
          .select("id,performance_id,rating,content,created_at")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("brand_likes")
          .select("brand_id, ballet_brands(id, name_ko, name_en, logo_url)")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      // 기록 처리
      const recordRows = (recordsRes.data ?? []) as Array<{
        id: string;
        record_date: string;
        start_time: string;
        end_time: string;
        content: string;
        mood: number | null;
        created_at: string;
      }>;
      setRecordsPreview(
        recordRows.map((row) => ({
          id: row.id,
          recordDate: row.record_date,
          startTime: row.start_time,
          endTime: row.end_time,
          content: row.content,
          mood: row.mood,
          createdAt: row.created_at,
        }))
      );

      if (recordRows.length > 0) {
        const recordIds = recordRows.map((r) => r.id);
        const { data: mediaRows } = await supabase
          .from("record_media")
          .select("record_id,url,created_at")
          .in("record_id", recordIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: true });
        const mediaById: Record<string, { urls: string[]; count: number }> = {};
        (mediaRows ?? []).forEach((row) => {
          if (!mediaById[row.record_id]) {
            mediaById[row.record_id] = { urls: [row.url], count: 1 };
            return;
          }
          mediaById[row.record_id].count += 1;
          if (mediaById[row.record_id].urls.length < 3) {
            mediaById[row.record_id].urls.push(row.url);
          }
        });
        setRecordMediaById(mediaById);
      }

      // 리뷰 처리
      const reviewRows = (reviewsRes.data ?? []) as Array<{
        id: string;
        performance_id: string;
        rating: number;
        content: string | null;
        created_at: string;
      }>;
      if (reviewRows.length > 0) {
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
        setReviewsPreview(
          reviewRows.map((row) => ({
            id: row.id,
            performanceId: row.performance_id,
            performanceName: performanceMap.get(row.performance_id)?.name ?? null,
            performancePoster: performanceMap.get(row.performance_id)?.poster ?? null,
            rating: row.rating,
            content: row.content,
            createdAt: row.created_at,
          }))
        );
        const likeCounts: Record<string, number> = {};
        (likeRes.data ?? []).forEach((row) => {
          likeCounts[row.review_id] = (likeCounts[row.review_id] ?? 0) + 1;
        });
        setReviewLikeCounts(likeCounts);
        const commentCounts: Record<string, number> = {};
        (commentRes.data ?? []).forEach((row) => {
          commentCounts[row.review_id] = (commentCounts[row.review_id] ?? 0) + 1;
        });
        setReviewCommentCounts(commentCounts);
        const images: Record<string, string[]> = {};
        (imageRes.data ?? []).forEach((row) => {
          images[row.review_id] = [...(images[row.review_id] ?? []), row.url];
        });
        setReviewImages(images);
      }

      // 브랜드 처리
      setLikedBrandsPreview(
        (brandsRes.data ?? [])
          .filter((row) => row.ballet_brands !== null)
          .map((row) => ({
            brand_id: row.brand_id,
            name_ko: (row.ballet_brands as { name_ko: string; name_en: string | null; logo_url: string | null }).name_ko,
            name_en: (row.ballet_brands as { name_ko: string; name_en: string | null; logo_url: string | null }).name_en,
            logo_url: (row.ballet_brands as { name_ko: string; name_en: string | null; logo_url: string | null }).logo_url,
          }))
      );

      setPreviewLoading(false);
    };

    fetchAll();
  }, [user, loading, pathname, openLoginSheet]);

  useEffect(() => {
    if (!user || profileLoading || previewLoading) return;
    setProfileCache<ProfileCachePayload>(user.id, {
      profile,
      recordCount,
      totalMinutes,
      reviewCount,
      recordsPreview,
      recordMediaById,
      reviewsPreview,
      reviewLikeCounts,
      reviewCommentCounts,
      reviewImages,
      likedBrandsPreview,
    });
  }, [
    user, profile, recordCount, totalMinutes, reviewCount,
    recordsPreview, recordMediaById, reviewsPreview,
    reviewLikeCounts, reviewCommentCounts, reviewImages,
    likedBrandsPreview, profileLoading, previewLoading,
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
  const careerDuration = profile?.ballet_started_at
    ? formatCareerDuration(profile.ballet_started_at)
    : null;

  return (
    <>
      <main className="px-4 pb-[140px]">
        <header className="sticky top-0 z-20 bg-white -mx-4 px-4 h-12 mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">프로필</h1>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="relative text-[#17171c]/70"
              onClick={() => router.push("/notifications")}
              aria-label="알림"
            >
              <Bell className="size-6" />
              {hasUnreadNotifications ? (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FF154A]" />
              ) : null}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="relative text-[#17171c]/70"
              onClick={() => router.push("/profile/menu")}
              aria-label="더보기"
            >
              <Settings className="size-6" />
              {hasUnreadNotices ? (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FF154A]" />
              ) : null}
            </Button>
          </div>
        </header>

        {/* 프로필 카드 */}
        <section className="rounded-xl border border-[#17171c]/5 bg-white p-4 shadow-sm">
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
                  className="h-20 w-20 overflow-hidden rounded-full border border-[#17171c]/10 bg-[#17171c]/5"
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

              <div className="mt-4 grid grid-cols-3 divide-x divide-[#17171c]/10 rounded-xl border border-[#17171c]/5 bg-white py-3">
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

        {/* 발레 기록 섹션 */}
        <section className="mt-4 rounded-xl border border-[#17171c]/5 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#17171c]">발레 기록</h2>
            <button
              type="button"
              className="flex items-center gap-0.5 text-xs text-[#17171c]/50"
              onClick={() => router.push("/profile/records")}
            >
              전체보기
              <ChevronRight className="size-3.5" />
            </button>
          </div>
          {previewLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={`record-skeleton-${index}`}
                  className="flex items-start gap-3 rounded-lg border border-[#17171c]/5 bg-white p-3"
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
          ) : recordsPreview.length === 0 ? (
            <p className="text-xs text-[#17171c]/60">
              첫번째 발레 기록을 남겨보세요.
            </p>
          ) : (
            <div className="space-y-3">
              {recordsPreview.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg border border-[#17171c]/5 bg-white p-3 text-left text-sm"
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
                            <div key={url} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[#17171c]/5">
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
            </div>
          )}
        </section>

        {/* 공연 리뷰 섹션 */}
        <section className="mt-4 rounded-xl border border-[#17171c]/5 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#17171c]">공연 리뷰</h2>
            <button
              type="button"
              className="flex items-center gap-0.5 text-xs text-[#17171c]/50"
              onClick={() => router.push("/profile/reviews")}
            >
              전체보기
              <ChevronRight className="size-3.5" />
            </button>
          </div>
          {previewLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
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
          ) : reviewsPreview.length === 0 ? (
            <p className="text-xs text-[#17171c]/60">
              첫번째 공연 리뷰를 남겨보세요.
            </p>
          ) : (
            <div className="space-y-3">
              {reviewsPreview.map((review) => (
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
                      <div className="flex items-center justify-between gap-2">
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
                                  <Star className="h-4 w-4 text-brand" fill="currentColor" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="shrink-0 text-xs text-[#17171c]/50">
                          {formatReviewDate(review.createdAt)}
                        </p>
                      </div>
                      {review.content ? (
                        <p className="mt-2 line-clamp-1 text-sm text-[#17171c]/70">
                          {review.content}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-center gap-4 text-xs text-[#17171c]">
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
                  {reviewImages[review.id]?.length ? (
                    <div className="mt-2 flex gap-1.5">
                      {reviewImages[review.id].slice(0, 3).map((url, idx) => {
                        const isLast = idx === Math.min(reviewImages[review.id].length, 3) - 1;
                        const remaining = reviewImages[review.id].length - 3;
                        return (
                          <div key={url} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[#17171c]/5">
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
            </div>
          )}
        </section>

        {/* 찜한 브랜드 섹션 */}
        <section className="mt-4 rounded-xl border border-[#17171c]/5 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#17171c]">찜한 브랜드</h2>
            <button
              type="button"
              className="flex items-center gap-0.5 text-xs text-[#17171c]/50"
              onClick={() => router.push("/profile/brands")}
            >
              전체보기
              <ChevronRight className="size-3.5" />
            </button>
          </div>
          {previewLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={`brand-skeleton-${index}`}
                  className="flex items-center gap-3 rounded-lg border border-[#17171c]/5 bg-white p-3"
                >
                  <Skeleton className="size-10 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : likedBrandsPreview.length === 0 ? (
            <p className="text-xs text-[#17171c]/60">
              첫번째 찜한 브랜드를 추가해보세요.
            </p>
          ) : (
            <div className="divide-y divide-[#17171c]/5">
              {likedBrandsPreview.map((brand) => (
                <button
                  key={brand.brand_id}
                  type="button"
                  className="flex w-full items-center gap-3 py-3 text-left"
                  onClick={() => router.push(`/brand/${brand.brand_id}`)}
                >
                  <div className="size-10 shrink-0 overflow-hidden rounded-xl bg-[#f5f5f7]">
                    {brand.logo_url ? (
                      <AnimatedImage
                        src={brand.logo_url}
                        alt={brand.name_ko}
                        width={40}
                        height={40}
                        sizes="40px"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="size-full" />
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium text-[#17171c]">{brand.name_ko}</p>
                    {brand.name_en && (
                      <p className="truncate text-xs text-[#17171c]/50">{brand.name_en}</p>
                    )}
                  </div>
                </button>
              ))}
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
