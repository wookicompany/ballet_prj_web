"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ImageViewer from "@/components/ui/image-viewer";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/lib/supabaseClient";
import { Menu, User } from "lucide-react";

type Profile = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
};

type ReviewSummary = {
  id: string;
  performanceId: string;
  performanceName: string | null;
  rating: number;
  createdAt: string;
};

function toMinutes(time: string) {
  const [hh, mm, ss] = time.split(":").map((value) => Number(value));
  return hh * 60 + mm + (ss ? Math.round(ss / 60) : 0);
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recordCount, setRecordCount] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [reviewAverage, setReviewAverage] = useState<number | null>(null);
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);

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

      const { data: reviewRows } = await supabase
        .from("performance_reviews")
        .select("id,performance_id,rating,created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (reviewRows && reviewRows.length > 0) {
        const performanceIds = Array.from(
          new Set(reviewRows.map((row) => row.performance_id))
        );
        const { data: performanceRows } = await supabase
          .from("kopis_performances")
          .select("mt20id,prfnm")
          .in("mt20id", performanceIds);

        const performanceMap = new Map<string, string | null>();
        (performanceRows ?? []).forEach((row) => {
          performanceMap.set(row.mt20id, row.prfnm);
        });

        const mapped = reviewRows.map((row) => ({
          id: row.id,
          performanceId: row.performance_id,
          performanceName: performanceMap.get(row.performance_id) ?? null,
          rating: row.rating,
          createdAt: row.created_at,
        }));
        setReviews(mapped);
        setReviewCount(mapped.length);
        const totalRating = mapped.reduce((sum, row) => sum + row.rating, 0);
        setReviewAverage(Math.round((totalRating / mapped.length) * 10) / 10);
      } else {
        setReviews([]);
        setReviewCount(0);
        setReviewAverage(null);
      }
    };

    fetchProfile();
  }, [user, router, loading, openLoginSheet]);

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

          <div className="mt-4 flex items-center gap-6 text-left text-xs text-[#17171c]/70">
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
            <span className="text-xs text-[#17171c]/60">
              {reviewAverage !== null
                ? `평균 ${reviewAverage}점 · ${reviewCount}개`
                : "아직 리뷰가 없어요."}
            </span>
          </div>

          {reviews.length === 0 ? (
            <p className="text-xs text-[#17171c]/60">
              첫 리뷰를 남겨보세요.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.slice(0, 3).map((review) => (
                <Card key={review.id} className="border-black/5">
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-center justify-between text-xs text-[#17171c]/60">
                      <span>{review.performanceName || "공연명 미정"}</span>
                      <span>별점 {review.rating}점</span>
                    </div>
                    <button
                      type="button"
                      className="w-full text-left text-xs text-[#17171c]/70"
                      onClick={() =>
                        router.push(
                          `/performance/${review.performanceId}/reviews/${review.id}`
                        )
                      }
                    >
                      리뷰 상세 보기
                    </button>
                  </CardContent>
                </Card>
              ))}
              {reviewCount > 3 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push("/performance")}
                >
                  공연 리뷰 더 보기
                </Button>
              ) : null}
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
