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
import ImageViewer from "@/components/ui/image-viewer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
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

type ReviewDetail = {
  id: string;
  performance_id: string;
  rating: number;
  content: string | null;
  created_at: string;
  user_id: string;
};

type PerformanceInfo = {
  mt20id: string;
  prfnm: string | null;
  poster: string | null;
};

type ProfileSummary = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
};

type CommentItem = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
};

const COMMENT_PAGE_SIZE = 10;
const COMMENT_INPUT_BASE_HEIGHT = 40;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR");
};

const getStarFillRatio = (rating10: number, starIndex: number) => {
  const value = rating10 / 2 - (starIndex - 1);
  return value >= 1 ? 1 : 0;
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
  const [performance, setPerformance] = useState<PerformanceInfo | null>(null);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentProfiles, setCommentProfiles] = useState<
    Record<string, ProfileSummary>
  >({});
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const newCommentRef = useRef<HTMLTextAreaElement | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [commentLikeCounts, setCommentLikeCounts] = useState<
    Record<string, number>
  >({});
  const [commentLikedMap, setCommentLikedMap] = useState<Record<string, boolean>>(
    {}
  );
  const [commentPage, setCommentPage] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedPagesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fetchReviewDetail = async () => {
      setLoading(true);
      const { data: reviewData, error: reviewError } = await supabase
        .from("performance_reviews")
        .select("id,performance_id,rating,content,created_at,user_id")
        .eq("id", reviewId)
        .eq("performance_id", performanceId)
        .is("deleted_at", null)
        .maybeSingle();

      if (reviewError || !reviewData) {
        toast("리뷰 정보를 불러오지 못했어요.");
        setReview(null);
        setLoading(false);
        return;
      }

      setReview(reviewData as ReviewDetail);

      const [
        { data: performanceData },
        { data: profileData },
        { data: imageRows },
        { data: likeRows },
        { count: commentTotal },
      ] = await Promise.all([
        supabase
          .from("kopis_performances")
          .select("mt20id,prfnm,poster")
          .eq("mt20id", performanceId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("id,nickname,avatar_url")
          .eq("id", reviewData.user_id)
          .maybeSingle(),
        supabase
          .from("performance_review_images")
          .select("url")
          .eq("review_id", reviewId),
        supabase
          .from("performance_review_likes")
          .select("review_id")
          .eq("review_id", reviewId),
        supabase
          .from("performance_review_comments")
          .select("id", { count: "exact", head: true })
          .eq("review_id", reviewId)
          .is("deleted_at", null),
      ]);

      setPerformance(performanceData as PerformanceInfo | null);
      setProfile(profileData as ProfileSummary | null);
      setImages((imageRows ?? []).map((row) => row.url).filter(Boolean));
      setLikeCount((likeRows ?? []).length);
      setCommentCount(commentTotal ?? 0);
      setLoading(false);
    };

    fetchReviewDetail();
  }, [performanceId, reviewId]);

  useEffect(() => {
    setComments([]);
    setCommentProfiles({});
    setHasMoreComments(true);
    setCommentPage(1);
    requestedPagesRef.current = new Set();
  }, [reviewId]);

  useEffect(() => {
    if (!sentinelRef.current || loadingComments || !hasMoreComments) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setCommentPage((prev) => prev + 1);
      }
    });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadingComments, hasMoreComments]);

  useEffect(() => {
    const fetchCommentsPage = async () => {
      if (commentPage === 0 || !hasMoreComments) return;
      if (requestedPagesRef.current.has(commentPage)) return;
      requestedPagesRef.current.add(commentPage);
      setLoadingComments(true);

      const from = (commentPage - 1) * COMMENT_PAGE_SIZE;
      const to = from + COMMENT_PAGE_SIZE - 1;

      const { data: commentRows, error } = await supabase
        .from("performance_review_comments")
        .select("id,content,created_at,user_id")
        .eq("review_id", reviewId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        setLoadingComments(false);
        return;
      }

      const nextRows = (commentRows as CommentItem[]) ?? [];
      setComments((prev) => {
        const existing = new Set(prev.map((row) => row.id));
        return [...prev, ...nextRows.filter((row) => !existing.has(row.id))];
      });

      if (nextRows.length < COMMENT_PAGE_SIZE) {
        setHasMoreComments(false);
      }

      const userIds = Array.from(new Set(nextRows.map((row) => row.user_id)));
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id,nickname,avatar_url")
          .in("id", userIds);
        const nextProfiles: Record<string, ProfileSummary> = {};
        (profileRows ?? []).forEach((row) => {
          nextProfiles[row.id] = row as ProfileSummary;
        });
        setCommentProfiles((prev) => ({ ...prev, ...nextProfiles }));
      }

      const commentIds = nextRows.map((row) => row.id);
      if (commentIds.length > 0) {
        const [likeRows, likedRows] = await Promise.all([
          supabase
            .from("performance_review_comment_likes")
            .select("comment_id")
            .in("comment_id", commentIds),
          user
            ? supabase
                .from("performance_review_comment_likes")
                .select("comment_id")
                .eq("user_id", user.id)
                .in("comment_id", commentIds)
            : Promise.resolve({ data: [] }),
        ]);

        const nextLikeCounts: Record<string, number> = {};
        (likeRows.data ?? []).forEach((row) => {
          nextLikeCounts[row.comment_id] =
            (nextLikeCounts[row.comment_id] ?? 0) + 1;
        });
        setCommentLikeCounts((prev) => ({ ...prev, ...nextLikeCounts }));

        if (user) {
          const nextLiked: Record<string, boolean> = {};
          (likedRows.data ?? []).forEach((row) => {
            nextLiked[row.comment_id] = true;
          });
          setCommentLikedMap((prev) => ({ ...prev, ...nextLiked }));
        }
      }

      setLoadingComments(false);
    };

    fetchCommentsPage();
  }, [commentPage, reviewId, hasMoreComments]);

  useEffect(() => {
    if (!newCommentRef.current) return;
    if (!newComment) {
      newCommentRef.current.style.height = `${COMMENT_INPUT_BASE_HEIGHT}px`;
      return;
    }
    newCommentRef.current.style.height = "auto";
    newCommentRef.current.style.height = `${Math.max(
      newCommentRef.current.scrollHeight,
      COMMENT_INPUT_BASE_HEIGHT
    )}px`;
  }, [newComment]);

  const commentSummary = useMemo(
    () => (commentCount > 0 ? `댓글 ${commentCount}개` : ""),
    [commentCount]
  );

  const handleSubmitComment = async () => {
    if (!user) {
      openLoginSheet();
      return;
    }
    const trimmed = newComment.trim();
    if (!trimmed) {
      toast("댓글을 입력해 주세요.");
      return;
    }
    setSubmittingComment(true);
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) {
      setSubmittingComment(false);
      return;
    }
    const response = await fetch("/api/review-comments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        review_id: reviewId,
        content: trimmed,
      }),
    });

    if (!response.ok) {
      toast("댓글을 저장하지 못했어요.");
      setSubmittingComment(false);
      return;
    }
    const data = (await response.json()) as CommentItem | null;
    if (!data) {
      toast("댓글을 저장하지 못했어요.");
      setSubmittingComment(false);
      return;
    }

    setComments((prev) => [data as CommentItem, ...prev]);
    setCommentCount((prev) => prev + 1);
    setNewComment("");

    if (!commentProfiles[user.id]) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,nickname,avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (profileData) {
        setCommentProfiles((prev) => ({
          ...prev,
          [user.id]: profileData as ProfileSummary,
        }));
      }
    }
    setSubmittingComment(false);
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!user) {
      openLoginSheet();
      return;
    }
    const trimmed = editingCommentContent.trim();
    if (!trimmed) {
      toast("댓글을 입력해 주세요.");
      return;
    }
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) return;
    const response = await fetch(`/api/review-comments/${commentId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: trimmed }),
    });
    if (!response.ok) {
      toast("댓글을 수정하지 못했어요.");
      return;
    }
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId ? { ...comment, content: trimmed } : comment
      )
    );
    setEditingCommentId(null);
    setEditingCommentContent("");
  };

  const handleDeleteComment = async () => {
    if (!user || !deleteCommentId) return;
    const target = comments.find((comment) => comment.id === deleteCommentId);
    if (!target) {
      toast("삭제할 댓글을 찾지 못했어요.");
      return;
    }
    if (target.user_id !== user.id) {
      toast("내 댓글만 삭제할 수 있어요.");
      return;
    }
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) return;
    const response = await fetch(
      `/api/review-comments/${deleteCommentId}/delete`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );
    if (!response.ok) {
      toast("댓글을 삭제하지 못했어요.");
      return;
    }
    setComments((prev) => prev.filter((comment) => comment.id !== deleteCommentId));
    setCommentCount((prev) => Math.max(0, prev - 1));
    setDeleteCommentId(null);
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (!user) {
      openLoginSheet();
      return;
    }
    const isLiked = commentLikedMap[commentId];
    setCommentLikedMap((prev) => ({ ...prev, [commentId]: !isLiked }));
    setCommentLikeCounts((prev) => ({
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
        setCommentLikedMap((prev) => ({ ...prev, [commentId]: true }));
        setCommentLikeCounts((prev) => ({
          ...prev,
          [commentId]: (prev[commentId] ?? 1) + 1,
        }));
      }
      return;
    }

    const { error } = await supabase
      .from("performance_review_comment_likes")
      .insert({ comment_id: commentId, user_id: user.id });
    if (error) {
      setCommentLikedMap((prev) => ({ ...prev, [commentId]: false }));
      setCommentLikeCounts((prev) => ({
        ...prev,
        [commentId]: Math.max(0, (prev[commentId] ?? 1) - 1),
      }));
    }
  };

  if (loading) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  if (!review) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center text-sm text-[#17171c]/60">
          리뷰 정보를 찾을 수 없어요.
        </main>
      </MobileContainer>
    );
  }

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
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => {
              if (!user) {
                openLoginSheet();
                return;
              }
              setActionSheetOpen(true);
            }}
            aria-label="리뷰 메뉴"
          >
            <MoreHorizontal className="size-5" />
          </Button>
        </header>

        <section className="space-y-4 rounded-xl border border-black/5 bg-white p-4">
          {performance ? (
            <div className="flex items-center gap-3">
              <div className="h-16 w-12 overflow-hidden rounded-lg border border-black/5 bg-black/5">
                {performance.poster ? (
                  <FadeInImage
                    src={performance.poster}
                    alt={`${performance.prfnm ?? "공연"} 포스터`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] text-[#17171c]/50">
                    이미지 없음
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#17171c]/60">공연</p>
                <p className="text-sm font-semibold text-[#17171c]">
                  {performance.prfnm || "공연명 미정"}
                </p>
              </div>
            </div>
          ) : null}

          <Separator className="bg-black/5" />

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#17171c]/60">
              <span>
                {profile?.nickname || "익명"} · {formatDate(review.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, index) => {
                const ratio = getStarFillRatio(review.rating, index + 1);
                return (
                  <div key={`review-star-${index}`} className="relative h-4 w-4">
                    <Star className="h-4 w-4 text-[#ff273d]" fill="none" />
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
            <p className="whitespace-pre-line text-sm text-[#17171c]">
              {review.content || "내용이 없어요."}
            </p>
            {images.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {images.map((url, index) => (
                  <button
                    key={`${review.id}-img-${index}`}
                    type="button"
                    className="h-20 w-20 overflow-hidden rounded-lg bg-white"
                    onClick={() => {
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
            <div className="flex items-center gap-4 text-xs text-[#17171c]">
              <span className="inline-flex items-center gap-1">
                <Heart className="h-4 w-4 text-[#17171c]" />
                {likeCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-4 w-4 text-[#17171c]" />
                {commentCount}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-4 rounded-xl border border-black/5 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#17171c]">댓글</h2>
            {commentSummary ? (
              <span className="text-xs text-[#17171c]/60">{commentSummary}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <textarea
              ref={newCommentRef}
              rows={1}
              value={newComment}
              onChange={(event) => {
                setNewComment(event.target.value);
                if (newCommentRef.current) {
                  newCommentRef.current.style.height = "auto";
                  newCommentRef.current.style.height = `${Math.max(
                    newCommentRef.current.scrollHeight,
                    COMMENT_INPUT_BASE_HEIGHT
                  )}px`;
                }
              }}
              onFocus={(event) => {
                if (!user) {
                  openLoginSheet();
                  event.currentTarget.blur();
                }
              }}
              className="h-14 min-h-14 flex-1 resize-none rounded-md border border-black/5 bg-white p-3 text-base placeholder:text-base text-[#17171c] focus:outline-none"
              maxLength={300}
              placeholder="댓글을 입력해 주세요."
            />
            <Button
              type="button"
              className="h-10 w-16 bg-[#17171c] text-white hover:bg-[#17171c]/90 flex items-center justify-center"
              onClick={handleSubmitComment}
              disabled={submittingComment}
            >
              {submittingComment ? <Spinner size="sm" className="text-white" /> : "등록"}
            </Button>
          </div>
          <div className="space-y-3">
            {comments.length === 0 && !loadingComments ? (
              <p className="text-xs text-[#17171c]/60">아직 댓글이 없어요.</p>
            ) : (
              comments.map((comment) => {
                const author = commentProfiles[comment.user_id];
                return (
                  <div
                    key={comment.id}
                    className="rounded-lg border border-black/5 p-3 text-xs text-[#17171c]"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#17171c]/60">
                      <span>
                        {author?.nickname || "익명"} ·{" "}
                        {formatDate(comment.created_at)}
                      </span>
                      {user?.id === comment.user_id ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-[#17171c]/60"
                              aria-label="댓글 메뉴"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-32 p-1">
                            <Button
                              type="button"
                              variant="ghost"
                              className="w-full justify-start text-sm"
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentContent(comment.content);
                              }}
                            >
                              <PenLine className="mr-2 h-4 w-4" />
                              수정하기
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="w-full justify-start text-sm text-red-500 hover:text-red-500"
                              onClick={() => setDeleteCommentId(comment.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              삭제하기
                            </Button>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="h-6 w-6" />
                      )}
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={editingCommentContent}
                          onChange={(event) =>
                            setEditingCommentContent(event.target.value)
                          }
                          className="min-h-[120px] w-full rounded-md border border-black/5 bg-white p-3 text-base text-[#17171c] focus:outline-none"
                          maxLength={300}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 flex-1"
                            onClick={() => handleUpdateComment(comment.id)}
                          >
                            저장
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 flex-1"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingCommentContent("");
                            }}
                          >
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-2 whitespace-pre-line text-xs text-[#17171c]">
                          {comment.content}
                        </p>
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#17171c]"
                          onClick={() => handleToggleCommentLike(comment.id)}
                          aria-label="댓글 좋아요"
                        >
                          <Heart
                            className="h-4 w-4 text-[#17171c]"
                            fill={
                              commentLikedMap[comment.id] ? "#17171c" : "none"
                            }
                          />
                          {commentLikeCounts[comment.id] ?? 0}
                        </button>
                      </>
                    )}
                  </div>
                );
              })
            )}
            {loadingComments ? (
              <div className="flex justify-center py-2">
                <Spinner size="sm" />
              </div>
            ) : null}
            <div ref={sentinelRef} />
          </div>
        </section>
      </main>

      <BottomSheet
        open={actionSheetOpen}
        onOpenChange={setActionSheetOpen}
        title="리뷰 메뉴"
      >
        {user?.id === review.user_id ? (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start"
              onClick={() => {
                setActionSheetOpen(false);
                router.push(
                  `/performance/${performanceId}/reviews/${reviewId}/edit`
                );
              }}
            >
              <PenLine className="mr-2 h-4 w-4" />
              수정하기
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start text-red-500 hover:text-red-500"
              onClick={() => {
                setActionSheetOpen(false);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              삭제하기
            </Button>
          </div>
        ) : (
          <div className="text-sm text-[#17171c]/60">
            내 리뷰에서만 사용할 수 있어요.
          </div>
        )}
      </BottomSheet>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
                if (!user) {
                  openLoginSheet();
                  return;
                }
                const session = await ensureSessionOrLogin(openLoginSheet);
                if (!session) return;
                const response = await fetch(`/api/reviews/${reviewId}/delete`, {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                  },
                });
                if (!response.ok) {
                  toast("리뷰를 삭제하지 못했어요.");
                  return;
                }
                router.replace(`/performance/${performanceId}`);
              }}
            >
              삭제할게요
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteCommentId)}
        onOpenChange={(open) => {
          if (!open) setDeleteCommentId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>댓글을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제하면 되돌릴 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-2">
            <AlertDialogCancel className="flex-1">취소</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              className="flex-1 text-red-500 hover:text-red-500"
              onClick={handleDeleteComment}
            >
              삭제할게요
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImageViewer
        isOpen={viewerOpen}
        imageUrl={viewerUrl}
        alt="리뷰 이미지 크게 보기"
        onClose={() => setViewerOpen(false)}
      />
    </MobileContainer>
  );
}
