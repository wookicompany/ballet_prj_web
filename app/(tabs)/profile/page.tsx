"use client";

import { useEffect, useMemo, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import BottomSheet from "@/components/sheets/BottomSheet";
import ImageViewer from "@/components/ui/image-viewer";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getAccessToken } from "@/lib/authSession";
import { formatCareerDuration, formatIsoToSeoulDate } from "@/lib/kstDateTime";
import { getProfileCache, setProfileCache } from "@/lib/profileCache";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Bell, ChevronDown, ChevronRight, Heart, MessageCircle, Quote, Settings, Share2, Shirt, Star, StickyNote, TrendingUp, User } from "lucide-react";

type RecordStat = {
  record_date: string;
  start_time: string;
  end_time: string;
};

type Profile = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  ballet_started_at: string | null;
  favorite_dancer_1: string | null;
  favorite_dancer_2: string | null;
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
  didWell: string | null;
  improveNext: string | null;
  outfit: string | null;
  memo: string | null;
  workoutTotalEnergyKcal: number | null;
};

type LikedBrand = {
  brand_id: string;
  name_ko: string;
  name_en: string | null;
  logo_url: string | null;
};

type LocationStat = { name: string; count: number };
type InstructorStat = { name: string; count: number };
type AllLocationInstructorRow = { location: string | null; instructor: string | null; record_date: string };

type ProfileCachePayload = {
  profile: Profile | null;
  recordCount: number;
  recordDayCount: number;
  totalMinutes: number;
  reviewCount: number;
  allRecordStats: RecordStat[];
  allLocationInstructorRows: AllLocationInstructorRow[];
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
  const [recordDayCount, setRecordDayCount] = useState(() => profileCached?.recordDayCount ?? 0);
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
  const [allLocationInstructorRows, setAllLocationInstructorRows] = useState<AllLocationInstructorRow[]>(() => profileCached?.allLocationInstructorRows ?? []);
  const [allRecordStats, setAllRecordStats] = useState<RecordStat[]>(() => profileCached?.allRecordStats ?? []);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [yearSheetOpen, setYearSheetOpen] = useState(false);
  const [metricSheetOpen, setMetricSheetOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<"days" | "count" | "time">("days");
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
      const [profileRes, recordStatsRes, reviewCountRes, locationInstructorRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,nickname,avatar_url,ballet_started_at,favorite_dancer_1,favorite_dancer_2")
          .eq("id", user.id)
          .single(),
        supabase
          .from("records")
          .select("start_time,end_time,record_date")
          .eq("user_id", user.id)
          .is("deleted_at", null),
        supabase
          .from("performance_reviews")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("deleted_at", null),
        supabase
          .from("records")
          .select("location,instructor,record_date")
          .eq("user_id", user.id)
          .is("deleted_at", null),
      ]);

      if (!profileRes.data) {
        await supabase.from("profiles").insert({ id: user.id });
        setProfile({ id: user.id, nickname: null, avatar_url: null, ballet_started_at: null, favorite_dancer_1: null, favorite_dancer_2: null });
      } else {
        setProfile(profileRes.data as Profile);
      }

      const recordStatsLocal = recordStatsRes.data ?? [];
      setRecordCount(recordStatsLocal.length);
      setRecordDayCount(new Set(recordStatsLocal.map((r) => r.record_date).filter(Boolean)).size);
      setTotalMinutes(
        recordStatsLocal.reduce(
          (sum, record) => sum + (toMinutes(record.end_time) - toMinutes(record.start_time)),
          0
        )
      );
      setAllRecordStats(recordStatsLocal as RecordStat[]);
      setReviewCount(reviewCountRes.count ?? 0);

      setAllLocationInstructorRows((locationInstructorRes.data ?? []) as AllLocationInstructorRow[]);

      setProfileLoading(false);

      // Step 2: 미리보기 데이터 3개씩 병렬 fetch
      const [recordsRes, reviewsRes, brandsRes] = await Promise.all([
        supabase
          .from("records")
          .select("id,record_date,start_time,end_time,content,mood,created_at,did_well,improve_next,outfit,memo,workout_total_energy_kcal")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("record_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("performance_reviews")
          .select("id,performance_id,rating,content,created_at")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("brand_likes")
          .select("brand_id, ballet_brands(id, name_ko, name_en, logo_url)")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5),
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
        did_well: string | null;
        improve_next: string | null;
        outfit: string | null;
        memo: string | null;
        workout_total_energy_kcal: number | null;
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
          didWell: row.did_well,
          improveNext: row.improve_next,
          outfit: row.outfit,
          memo: row.memo,
          workoutTotalEnergyKcal: row.workout_total_energy_kcal,
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
      recordDayCount,
      totalMinutes,
      reviewCount,
      allRecordStats,
      recordsPreview,
      recordMediaById,
      reviewsPreview,
      reviewLikeCounts,
      reviewCommentCounts,
      reviewImages,
      likedBrandsPreview,
      allLocationInstructorRows,
    });
  }, [
    user, profile, recordCount, recordDayCount, totalMinutes, reviewCount,
    allRecordStats, allLocationInstructorRows, recordsPreview, recordMediaById, reviewsPreview,
    reviewLikeCounts, reviewCommentCounts, reviewImages,
    likedBrandsPreview, profileLoading, previewLoading,
  ]);

  const availableYears = useMemo(() => {
    if (allRecordStats.length === 0) return [new Date().getFullYear()];
    const years = [...new Set(allRecordStats.map((r) => Number(r.record_date.slice(0, 4))))].sort((a, b) => b - a);
    return years;
  }, [allRecordStats]);

  const monthlyStats = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    return months.map((month) => {
      const monthStr = `${selectedYear}-${String(month).padStart(2, "0")}`;
      const filtered = allRecordStats.filter((r) => r.record_date.startsWith(monthStr));
      const days = new Set(filtered.map((r) => r.record_date)).size;
      const count = filtered.length;
      const mins = filtered.reduce(
        (sum, r) => sum + (toMinutes(r.end_time) - toMinutes(r.start_time)),
        0
      );
      return { month, days, count, mins };
    });
  }, [allRecordStats, selectedYear]);

  const currentMonthStat = useMemo(() => {
    const now = new Date();
    return monthlyStats[now.getMonth()];
  }, [monthlyStats]);

  const topLocations = useMemo((): LocationStat[] => {
    const counts: Record<string, number> = {};
    allLocationInstructorRows
      .filter((r) => r.record_date.startsWith(String(selectedYear)))
      .forEach((r) => {
        if (!r.location) return;
        const name = r.location.includes(" | ") ? r.location.split(" | ")[0].trim() : r.location.trim();
        if (!name) return;
        counts[name] = (counts[name] ?? 0) + 1;
      });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));
  }, [allLocationInstructorRows, selectedYear]);

  const topInstructors = useMemo((): InstructorStat[] => {
    const counts: Record<string, number> = {};
    allLocationInstructorRows
      .filter((r) => r.record_date.startsWith(String(selectedYear)))
      .forEach((r) => {
        if (!r.instructor) return;
        const name = r.instructor.trim().replace(/선생님$/, "").trim();
        if (!name) return;
        counts[name] = (counts[name] ?? 0) + 1;
      });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));
  }, [allLocationInstructorRows, selectedYear]);

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

  const handleShare = () => {
    sendHapticToApp();
    const url = `${window.location.origin}/u/${user.id}`;
    if (navigator.share) {
      navigator.share({ title: `${displayName}님의 발레 기록`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast("링크가 복사됐어요.");
      }).catch(() => {
        toast("링크 복사에 실패했어요.");
      });
    }
  };

  return (
    <>
      <main className="px-4 pb-[140px]">
        <header className="sticky top-0 z-20 bg-background -mx-4 px-4 h-12 mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">프로필</h1>
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
                      sendHapticToApp();
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
                <button
                  type="button"
                  onClick={handleShare}
                  className="self-start p-1 text-[#17171c]/50 active:opacity-70"
                  aria-label="프로필 공유"
                >
                  <Share2 className="size-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-[#17171c]/10 rounded-xl border border-[#17171c]/5 bg-white py-3">
                <div className="flex flex-col items-center justify-center px-2">
                  <p className="text-sm font-semibold leading-none text-[#17171c]">
                    {recordDayCount}일
                  </p>
                  <p className="mt-2 text-xs text-[#17171c]/60">기록 일수</p>
                </div>
                <div className="flex flex-col items-center justify-center px-2">
                  <p className="text-sm font-semibold leading-none text-[#17171c]">
                    {recordCount}회
                  </p>
                  <p className="mt-2 text-xs text-[#17171c]/60">기록 횟수</p>
                </div>
                <div className="flex flex-col items-center justify-center px-2">
                  <p className="text-sm font-semibold leading-none text-[#17171c]">
                    {hours}시간 {minutes}분
                  </p>
                  <p className="mt-2 text-xs text-[#17171c]/60">기록 시간</p>
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

        {/* 나의 기록 인사이트 */}
        {(profileLoading || allRecordStats.length > 0) && (
          <section className="mt-5 rounded-xl border border-[#17171c]/5 bg-white p-4 shadow-sm">
            {profileLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-14" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
                <div className="flex items-end gap-[6px] h-28 pt-2">
                  {[30, 55, 70, 45, 80, 60, 40, 75, 50, 35, 65, 20].map((h, i) => (
                    <Skeleton
                      key={`bar-skeleton-${i}`}
                      className="flex-1 rounded-t-sm"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <>
            {/* 이번 달 요약 */}
            {/* 헤더: 월별 기록 + 메트릭 선택 + 연도 선택 */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#17171c]">기록 요약</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMetricSheetOpen(true)}
                  className="flex items-center gap-0.5 text-xs text-[#17171c]/60 active:opacity-70"
                >
                  {chartMetric === "count" ? "기록 횟수" : chartMetric === "days" ? "기록 일수" : "기록 시간"}
                  <ChevronDown className="size-3.5" />
                </button>
                <span className="text-[#17171c]/20 text-xs">|</span>
                <button
                  type="button"
                  onClick={() => setYearSheetOpen(true)}
                  className="flex items-center gap-0.5 text-xs text-[#17171c]/60 active:opacity-70"
                >
                  {selectedYear}년
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
            </div>

            {/* 바 차트 */}
            {(() => {
              const values = monthlyStats.map((s) =>
                chartMetric === "count" ? s.count : chartMetric === "days" ? s.days : s.mins
              );
              const maxVal = Math.max(...values, 1);
              const BAR_HEIGHT = 120;
              return (
                <div className="flex items-end gap-[6px]">
                  {monthlyStats.map((s) => {
                    const val = chartMetric === "count" ? s.count : chartMetric === "days" ? s.days : s.mins;
                    const heightPct = val === 0 ? 0 : Math.max((val / maxVal) * 100, 6);
                    const label =
                      chartMetric === "time"
                        ? val >= 60
                          ? `${Math.floor(val / 60)}h`
                          : val > 0
                          ? `${val}m`
                          : ""
                        : val > 0
                        ? String(val)
                        : "";
                    return (
                      <div key={s.month} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] text-[#17171c]/50 h-3 leading-3">{label}</span>
                        <div className="w-full flex items-end" style={{ height: `${BAR_HEIGHT}px` }}>
                          <div
                            className="w-full rounded-t-sm bg-[#17171c]/80 transition-all duration-300"
                            style={{ height: val === 0 ? "0px" : `${(heightPct / 100) * BAR_HEIGHT}px` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#17171c]/40">{s.month}월</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {(topLocations.length > 0 || topInstructors.length > 0) && (
              <div className="mt-4 pt-4 border-t border-[#17171c]/5 space-y-4">
                {topLocations.length > 0 && (
                  <div>
                    <p className="text-xs text-[#17171c]/50 mb-2">자주 간 장소</p>
                    <div className="space-y-2">
                      {topLocations.map((loc, i) => (
                        <div key={loc.name} className="flex items-center gap-2">
                          <span className="text-xs text-[#17171c]/30 w-3">{i + 1}</span>
                          <span className="flex-1 text-sm text-[#17171c] truncate">{loc.name}</span>
                          <span className="text-xs text-[#17171c]/50">{loc.count}회</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {topInstructors.length > 0 && (
                  <div>
                    <p className="text-xs text-[#17171c]/50 mb-2">자주 만난 강사님</p>
                    <div className="space-y-2">
                      {topInstructors.map((ins, i) => (
                        <div key={ins.name} className="flex items-center gap-2">
                          <span className="text-xs text-[#17171c]/30 w-3">{i + 1}</span>
                          <span className="flex-1 text-sm text-[#17171c] truncate">{ins.name}</span>
                          <span className="text-xs text-[#17171c]/50">{ins.count}회</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </section>
        )}

        {/* 발레 기록 섹션 */}
        {(previewLoading || recordsPreview.length > 0) && (
        <section className="mt-5 rounded-xl border border-[#17171c]/5 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#17171c]">발레 기록</h2>
            <button
              type="button"
              className="flex items-center gap-0.5 text-xs text-[#17171c]/70"
              onClick={() => {
                sendHapticToApp();
                router.push("/profile/records");
              }}
            >
              전체보기
              <ChevronRight className="size-3.5" />
            </button>
          </div>
          {previewLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`record-skeleton-${index}`}
                  className="flex items-start gap-3 rounded-lg border border-[#17171c]/5 bg-white p-4"
                >
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : recordsPreview.length === 0 ? (
            <p className="text-xs text-[#17171c]/60">
              첫 번째 발레 기록을 남겨보세요.
            </p>
          ) : (
            <div className="space-y-3">
              {recordsPreview.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg border border-[#17171c]/5 bg-white p-4 text-left text-sm"
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
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-[#17171c]/60">
                        <span>{formatRecordTimeRange(record.startTime, record.endTime)}</span>
                        {record.workoutTotalEnergyKcal != null && (
                          <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-orange-400">
                            {record.workoutTotalEnergyKcal} kcal
                          </span>
                        )}
                      </div>
                      <p className="shrink-0 text-right text-xs text-[#17171c]/60">
                        {formatRecordDate(record.recordDate)}
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {record.content?.trim() && (
                        <p className="line-clamp-2 flex items-start gap-1.5 text-sm text-[#17171c]">
                          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                          {record.content}
                        </p>
                      )}
                      {record.didWell && (
                        <p className="line-clamp-2 flex items-start gap-1.5 text-sm text-[#17171c]">
                          <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                          {record.didWell}
                        </p>
                      )}
                      {record.improveNext && (
                        <p className="line-clamp-2 flex items-start gap-1.5 text-sm text-[#17171c]">
                          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          {record.improveNext}
                        </p>
                      )}
                      {record.outfit && (
                        <p className="line-clamp-2 flex items-start gap-1.5 text-sm text-[#17171c]">
                          <Shirt className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-400" />
                          {record.outfit}
                        </p>
                      )}
                      {record.memo && (
                        <p className="line-clamp-2 flex items-start gap-1.5 text-sm text-[#17171c]">
                          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                          {record.memo}
                        </p>
                      )}
                    </div>
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
        )}

        {/* 공연 리뷰 섹션 */}
        {(previewLoading || reviewsPreview.length > 0) && (
        <section className="mt-5 rounded-xl border border-[#17171c]/5 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#17171c]">공연 리뷰</h2>
            <button
              type="button"
              className="flex items-center gap-0.5 text-xs text-[#17171c]/70"
              onClick={() => {
                sendHapticToApp();
                router.push("/profile/reviews");
              }}
            >
              전체보기
              <ChevronRight className="size-3.5" />
            </button>
          </div>
          {previewLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
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
              첫 번째 공연 리뷰를 남겨보세요.
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
        )}

        {/* 찜한 브랜드 섹션 */}
        {(previewLoading || likedBrandsPreview.length > 0) && (
        <section className="mt-5 rounded-xl border border-[#17171c]/5 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#17171c]">찜한 브랜드</h2>
            <button
              type="button"
              className="flex items-center gap-0.5 text-xs text-[#17171c]/70"
              onClick={() => {
                sendHapticToApp();
                router.push("/profile/brands");
              }}
            >
              전체보기
              <ChevronRight className="size-3.5" />
            </button>
          </div>
          {previewLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
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
              첫 번째 찜한 브랜드를 추가해보세요.
            </p>
          ) : (
            <div className="divide-y divide-[#17171c]/5">
              {likedBrandsPreview.map((brand) => (
                <button
                  key={brand.brand_id}
                  type="button"
                  className="flex w-full items-center gap-3 py-3 text-left"
                  onClick={() => {
                    sendHapticToApp();
                    router.push(`/brand/${brand.brand_id}`);
                  }}
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
        )}
      </main>

      <ImageViewer
        isOpen={avatarOpen}
        imageUrl={profile?.avatar_url ?? null}
        alt="프로필 이미지 크게 보기"
        onClose={() => setAvatarOpen(false)}
      />

      <BottomSheet
        open={yearSheetOpen}
        onOpenChange={setYearSheetOpen}
        title="연도 선택"
      >
        <div className="pb-8 flex flex-col gap-1">
          {availableYears.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => {
                setSelectedYear(year);
                setYearSheetOpen(false);
              }}
              className={`w-full rounded-xl py-3 text-sm font-medium transition-colors ${
                year === selectedYear
                  ? "bg-[#17171c] text-white"
                  : "bg-[#f7f7f9] text-[#17171c]"
              }`}
            >
              {year}년
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={metricSheetOpen}
        onOpenChange={setMetricSheetOpen}
        title="보기 방식"
      >
        <div className="pb-8 flex flex-col gap-1">
          {(["days", "count", "time"] as const).map((m) => {
            const label = m === "count" ? "기록 횟수" : m === "days" ? "기록 일수" : "기록 시간";
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setChartMetric(m);
                  setMetricSheetOpen(false);
                }}
                className={`w-full rounded-xl py-3 text-sm font-medium transition-colors ${
                  m === chartMetric
                    ? "bg-[#17171c] text-white"
                    : "bg-[#f7f7f9] text-[#17171c]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
