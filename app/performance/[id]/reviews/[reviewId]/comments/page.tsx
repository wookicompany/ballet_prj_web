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
import { ChevronLeft, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

type CommentItem = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
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

export default function PerformanceReviewCommentsPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reviewId: string }>();
  const performanceId = params.id;
  const reviewId = params.reviewId;
  const { user } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileSummary>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});

  const commentIds = useMemo(() => comments.map((comment) => comment.id), [
    comments,
  ]);

  useEffect(() => {
    const fetchComments = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("performance_review_comments")
        .select("id,content,created_at,user_id")
        .eq("review_id", reviewId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error) {
        toast("댓글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setComments([]);
        setLoading(false);
        return;
      }

      setComments((data as CommentItem[]) ?? []);
      setLoading(false);
    };

    fetchComments();
  }, [reviewId]);

  useEffect(() => {
    if (commentIds.length === 0) {
      setProfiles({});
      setLikeCounts({});
      setLikedMap({});
      return;
    }

    const fetchExtras = async () => {
      const userIds = Array.from(new Set(comments.map((comment) => comment.user_id)));
      const [{ data: profileRows }, { data: likeRows }] = await Promise.all([
        supabase.from("profiles").select("id,nickname").in("id", userIds),
        supabase
          .from("performance_review_comment_likes")
          .select("comment_id")
          .in("comment_id", commentIds),
      ]);

      const nextProfiles: Record<string, ProfileSummary> = {};
      (profileRows ?? []).forEach((row) => {
        nextProfiles[row.id] = row as ProfileSummary;
      });
      setProfiles(nextProfiles);

      const nextLikeCounts: Record<string, number> = {};
      (likeRows ?? []).forEach((row) => {
        nextLikeCounts[row.comment_id] =
          (nextLikeCounts[row.comment_id] ?? 0) + 1;
      });
      setLikeCounts(nextLikeCounts);

      if (!user) {
        setLikedMap({});
        return;
      }

      const { data: likedRows } = await supabase
        .from("performance_review_comment_likes")
        .select("comment_id")
        .eq("user_id", user.id)
        .in("comment_id", commentIds);
      const nextLiked: Record<string, boolean> = {};
      (likedRows ?? []).forEach((row) => {
        nextLiked[row.comment_id] = true;
      });
      setLikedMap(nextLiked);
    };

    fetchExtras();
  }, [commentIds, comments, user]);

  const handleToggleLike = async (commentId: string) => {
    if (!user) {
      openLoginSheet();
      return;
    }

    const isLiked = likedMap[commentId];
    setLikedMap((prev) => ({ ...prev, [commentId]: !isLiked }));
    setLikeCounts((prev) => ({
      ...prev,
      [commentId]: Math.max(0, (prev[commentId] ?? 0) + (isLiked ? -1 : 1)),
    }));

    if (isLiked) {
      const { error } = await supabase
        .from("performance_review_comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);
      if (error) {
        toast("좋아요를 취소하지 못했어요.");
        setLikedMap((prev) => ({ ...prev, [commentId]: true }));
        setLikeCounts((prev) => ({
          ...prev,
          [commentId]: (prev[commentId] ?? 1) + 1,
        }));
      }
      return;
    }

    const { error } = await supabase
      .from("performance_review_comment_likes")
      .insert({
        comment_id: commentId,
        user_id: user.id,
      });
    if (error) {
      toast("좋아요를 남기지 못했어요.");
      setLikedMap((prev) => ({ ...prev, [commentId]: false }));
      setLikeCounts((prev) => ({
        ...prev,
        [commentId]: Math.max(0, (prev[commentId] ?? 1) - 1),
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
          <h1 className="text-base font-semibold">댓글</h1>
          <div className="w-9" />
        </header>

        <section className="mb-6">
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
        </section>

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-[#17171c]/60">
            아직 댓글이 없어요.
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              const profile = profiles[comment.user_id];
              return (
                <Card key={comment.id} className="border-black/5">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between text-xs text-[#17171c]/60">
                      <span>
                        {profile?.nickname || "익명"} ·{" "}
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    <p className="whitespace-pre-line text-sm text-[#17171c]">
                      {comment.content}
                    </p>
                    <Separator className="bg-black/5" />
                    <button
                      type="button"
                      className={`flex items-center gap-1 text-xs ${
                        likedMap[comment.id] ? "text-[#ff273d]" : "text-[#17171c]/70"
                      }`}
                      onClick={() => handleToggleLike(comment.id)}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      좋아요 {likeCounts[comment.id] ?? 0}
                    </button>
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
