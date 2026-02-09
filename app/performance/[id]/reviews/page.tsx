"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, MessageCircle, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

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

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR");
};

export default function PerformanceReviewListPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const performanceId = params.id;
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileSummary>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const reviewIds = useMemo(() => reviews.map((review) => review.id), [reviews]);

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("performance_reviews")
        .select("id,rating,content,created_at,user_id")
        .eq("performance_id", performanceId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        toast("리뷰를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setReviews([]);
        setLoading(false);
        return;
      }

      setReviews((data as ReviewItem[]) ?? []);
      setLoading(false);
    };

    fetchReviews();
  }, [performanceId]);

  useEffect(() => {
    if (reviewIds.length === 0) {
      setProfiles({});
      setLikeCounts({});
      setLikedMap({});
      setCommentCounts({});
      return;
    }

    const fetchExtras = async () => {
      const userIds = Array.from(new Set(reviews.map((review) => review.user_id)));

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
      setProfiles(nextProfiles);

      const nextLikeCounts: Record<string, number> = {};
      (likeRows ?? []).forEach((row) => {
        nextLikeCounts[row.review_id] = (nextLikeCounts[row.review_id] ?? 0) + 1;
      });
      setLikeCounts(nextLikeCounts);

      const nextCommentCounts: Record<string, number> = {};
      (commentRows ?? []).forEach((row) => {
        nextCommentCounts[row.review_id] =
          (nextCommentCounts[row.review_id] ?? 0) + 1;
      });
      setCommentCounts(nextCommentCounts);

      if (!user) {
        setLikedMap({});
        return;
      }

      const { data: likedRows } = await supabase
        .from("performance_review_likes")
        .select("review_id")
        .eq("user_id", user.id)
        .in("review_id", reviewIds);
      const nextLiked: Record<string, boolean> = {};
      (likedRows ?? []).forEach((row) => {
        nextLiked[row.review_id] = true;
      });
      setLikedMap(nextLiked);
    };

    fetchExtras();
  }, [reviewIds, reviews, user]);

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

  return (
    <MobileContainer>
      <main className="px-4 pb-12 pt-6">
        <header className="mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <h1 className="text-base font-semibold">공연 리뷰</h1>
          <div className="w-9" />
        </header>

        <section className="mb-6">
          <Button
            type="button"
            className="h-11 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
            onClick={() => router.push(`/performance/${performanceId}/reviews/new`)}
          >
            리뷰 작성하기
          </Button>
        </section>

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-[#17171c]/60">
            아직 리뷰가 없어요.
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const profile = profiles[review.user_id];
              return (
                <Card key={review.id} className="border-black/5">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between text-xs text-[#17171c]/60">
                      <span>
                        {profile?.nickname || "익명"} · {formatDate(review.created_at)}
                      </span>
                      <span>별점 {review.rating}점</span>
                    </div>
                    <p className="whitespace-pre-line text-sm text-[#17171c]">
                      {review.content || "내용이 없어요."}
                    </p>
                    <Separator className="bg-black/5" />
                    <div className="flex items-center justify-between text-xs text-[#17171c]/70">
                      <button
                        type="button"
                        className={`flex items-center gap-1 ${
                          likedMap[review.id] ? "text-[#ff273d]" : ""
                        }`}
                        onClick={() => handleToggleLike(review.id)}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        좋아요 {likeCounts[review.id] ?? 0}
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-1"
                        onClick={() =>
                          router.push(
                            `/performance/${performanceId}/reviews/${review.id}`
                          )
                        }
                      >
                        <MessageCircle className="h-4 w-4" />
                        댓글 {commentCounts[review.id] ?? 0}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </MobileContainer>
  );
}
