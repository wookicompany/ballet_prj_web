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

type ReviewDetail = {
  id: string;
  rating: number;
  content: string | null;
  created_at: string;
  user_id: string;
};

type ReviewImage = {
  id: string;
  url: string;
};

type ProfileSummary = {
  id: string;
  nickname: string | null;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR");
};

export default function PerformanceReviewDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reviewId: string }>();
  const performanceId = params.id;
  const reviewId = params.reviewId;
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [images, setImages] = useState<ReviewImage[]>([]);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    const fetchReview = async () => {
      setLoading(true);
      const [{ data: reviewData, error: reviewError }, { data: imageRows }] =
        await Promise.all([
          supabase
            .from("performance_reviews")
            .select("id,rating,content,created_at,user_id")
            .eq("id", reviewId)
            .maybeSingle(),
          supabase
            .from("performance_review_images")
            .select("id,url")
            .eq("review_id", reviewId),
        ]);

      if (reviewError || !reviewData) {
        toast("리뷰를 불러오지 못했어요.");
        setReview(null);
        setLoading(false);
        return;
      }

      setReview(reviewData as ReviewDetail);
      setImages((imageRows as ReviewImage[]) ?? []);

      const [{ data: profileRow }, { data: likeRows }, { data: commentRows }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,nickname")
            .eq("id", reviewData.user_id)
            .maybeSingle(),
          supabase
            .from("performance_review_likes")
            .select("review_id,user_id")
            .eq("review_id", reviewId),
          supabase
            .from("performance_review_comments")
            .select("review_id")
            .eq("review_id", reviewId)
            .is("deleted_at", null),
        ]);

      setProfile(profileRow ? (profileRow as ProfileSummary) : null);
      setLikeCount(likeRows?.length ?? 0);
      setCommentCount(commentRows?.length ?? 0);
      setLiked(
        !!user &&
          (likeRows ?? []).some((row) => row.user_id === user.id)
      );
      setLoading(false);
    };

    fetchReview();
  }, [reviewId, user]);

  const handleToggleLike = async () => {
    if (!user) {
      openLoginSheet();
      return;
    }

    setLiked((prev) => !prev);
    setLikeCount((prev) => Math.max(0, prev + (liked ? -1 : 1)));

    if (liked) {
      const { error } = await supabase
        .from("performance_review_likes")
        .delete()
        .eq("review_id", reviewId)
        .eq("user_id", user.id);
      if (error) {
        toast("좋아요를 취소하지 못했어요.");
        setLiked(true);
        setLikeCount((prev) => prev + 1);
      }
      return;
    }

    const { error } = await supabase.from("performance_review_likes").insert({
      review_id: reviewId,
      user_id: user.id,
    });
    if (error) {
      toast("좋아요를 남기지 못했어요.");
      setLiked(false);
      setLikeCount((prev) => Math.max(0, prev - 1));
    }
  };

  const ratingLabel = useMemo(() => {
    if (!review) return "";
    return `별점 ${review.rating}점`;
  }, [review]);

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
          <h1 className="text-base font-semibold">리뷰 상세</h1>
          <div className="w-9" />
        </header>

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : !review ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-[#17171c]/60">
            리뷰를 찾을 수 없어요.
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="border-black/5">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between text-xs text-[#17171c]/60">
                  <span>
                    {profile?.nickname || "익명"} · {formatDate(review.created_at)}
                  </span>
                  <span>{ratingLabel}</span>
                </div>
                <p className="whitespace-pre-line text-sm text-[#17171c]">
                  {review.content || "내용이 없어요."}
                </p>
                <Separator className="bg-black/5" />
                <div className="flex items-center justify-between text-xs text-[#17171c]/70">
                  <button
                    type="button"
                    className={`flex items-center gap-1 ${
                      liked ? "text-[#ff273d]" : ""
                    }`}
                    onClick={handleToggleLike}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    좋아요 {likeCount}
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1"
                    onClick={() =>
                      router.push(
                        `/performance/${performanceId}/reviews/${reviewId}/comments`
                      )
                    }
                  >
                    <MessageCircle className="h-4 w-4" />
                    댓글 {commentCount}
                  </button>
                </div>
              </CardContent>
            </Card>

            {images.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-[#17171c]">
                  첨부 사진
                </h2>
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-black/5"
                    >
                      <img
                        src={image.url}
                        alt="리뷰 이미지"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <Button
              type="button"
              className="h-11 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
              onClick={() =>
                router.push(
                  `/performance/${performanceId}/reviews/${reviewId}/comments/new`
                )
              }
            >
              댓글 작성하기
            </Button>
          </div>
        )}
      </main>
    </MobileContainer>
  );
}
