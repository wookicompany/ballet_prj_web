"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { useParams, useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import UserProfileSummarySheet from "@/components/performance/UserProfileSummarySheet";
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
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { formatIsoToSeoulDate } from "@/lib/kstDateTime";
import { supabase } from "@/lib/supabaseClient";
import { ensureSessionOrLogin } from "@/lib/authSession";
import { sendHapticToApp } from "@/lib/reactNativeWebView";
import { invalidatePerformanceHomeCache } from "@/lib/performanceHomeCache";
import { invalidateDetailCache } from "@/lib/performanceDetailCache";
import { invalidateProfileCache } from "@/lib/profileCache";
import {
  REPORT_REASON_OPTIONS,
  REPORT_THRESHOLD,
  type ReportReasonCode,
} from "@/lib/reports";
import {
  ChevronLeft,
  Flag,
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
  report_count?: number;
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
  report_count?: number;
};

const COMMENT_PAGE_SIZE = 12;
const COMMENT_INPUT_BASE_HEIGHT = 40;

const getDisplayNickname = (
  nickname: string | null | undefined,
  userId: string,
  isProfileResolved: boolean,
) => {
  const trimmed = nickname?.trim();
  if (trimmed) return trimmed;
  if (!isProfileResolved) return "";
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

const formatDate = (value: string) => {
  return formatIsoToSeoulDate(value, "ko-KR");
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
  const [likedByMe, setLikedByMe] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentProfiles, setCommentProfiles] = useState<
    Record<string, ProfileSummary>
  >({});
  const [commentProfileResolvedMap, setCommentProfileResolvedMap] = useState<
    Record<string, boolean>
  >({});
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deletingReview, setDeletingReview] = useState(false);
  const [deletingComment, setDeletingComment] = useState(false);
  const [updatingComment, setUpdatingComment] = useState(false);
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
  const [orderedCommentIds, setOrderedCommentIds] = useState<string[]>([]);
  const [commentOrderReady, setCommentOrderReady] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentReportCounts, setCommentReportCounts] = useState<
    Record<string, number>
  >({});
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReasonCode>("SPAM");
  const [reportDetail, setReportDetail] = useState("");
  const [reporting, setReporting] = useState(false);
  const [userSummarySheetOpen, setUserSummarySheetOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    kind: "review" | "comment";
    id: string;
  } | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestedPagesRef = useRef<Set<number>>(new Set());
  const loadingCommentsRef = useRef(loadingComments);

  // Effect 1: 리뷰 기본 데이터 (user 무관 — 로그인 변경 시 재fetch 방지)
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

      const [
        { data: performanceData },
        profileMap,
        { data: imageRows },
        { data: likeRows },
        { count: commentTotal },
        { count: reviewReportCount },
      ] = await Promise.all([
        supabase
          .from("kopis_performances")
          .select("mt20id,prfnm,poster")
          .eq("mt20id", performanceId)
          .maybeSingle(),
        fetchPublicProfiles([reviewData.user_id]),
        supabase
          .from("performance_review_images")
          .select("url")
          .eq("review_id", reviewId)
          .is("deleted_at", null),
        supabase
          .from("performance_review_likes")
          .select("review_id")
          .eq("review_id", reviewId)
          .is("deleted_at", null),
        supabase
          .from("performance_review_comments")
          .select("id", { count: "exact", head: true })
          .eq("review_id", reviewId)
          .is("deleted_at", null),
        supabase
          .from("performance_review_reports")
          .select("id", { count: "exact", head: true })
          .eq("review_id", reviewId)
          .is("deleted_at", null),
      ]);

      setReview({
        ...(reviewData as ReviewDetail),
        report_count: reviewReportCount ?? 0,
      });
      setPerformance(performanceData as PerformanceInfo | null);
      setProfile(profileMap[reviewData.user_id] ?? null);
      setImages((imageRows ?? []).map((row) => row.url).filter(Boolean));
      setLikeCount((likeRows ?? []).length);
      setCommentCount(commentTotal ?? 0);
      setLoading(false);
    };

    fetchReviewDetail();
  }, [performanceId, reviewId]);

  // Effect 2: 내 좋아요 상태만 (user 의존 — 로그인 변경 시만 재조회)
  useEffect(() => {
    if (!user) {
      setLikedByMe(false);
      return;
    }
    const fetchMyLike = async () => {
      const { data: myLikeRow } = await supabase
        .from("performance_review_likes")
        .select("review_id")
        .eq("review_id", reviewId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();
      setLikedByMe(Boolean(myLikeRow));
    };
    fetchMyLike();
  }, [reviewId, user]);

  useEffect(() => {
    setComments([]);
    setCommentProfiles({});
    setCommentProfileResolvedMap({});
    setCommentReportCounts({});
    setHasMoreComments(true);
    setCommentPage(1);
    setOrderedCommentIds([]);
    setCommentOrderReady(false);
    requestedPagesRef.current = new Set();
  }, [reviewId]);

  useEffect(() => {
    const fetchCommentOrder = async () => {
      setCommentOrderReady(false);
      const { data: commentRows, error: commentError } = await supabase
        .from("performance_review_comments")
        .select("id,created_at")
        .eq("review_id", reviewId)
        .is("deleted_at", null);

      if (commentError) {
        setOrderedCommentIds([]);
        setHasMoreComments(false);
        setCommentOrderReady(true);
        return;
      }

      const rows = (commentRows ?? []) as Array<{ id: string; created_at: string }>;
      if (rows.length === 0) {
        setOrderedCommentIds([]);
        setHasMoreComments(false);
        setCommentOrderReady(true);
        return;
      }

      const commentIds = rows.map((row) => row.id);
      const { data: likeRows } = await supabase
        .from("performance_review_comment_likes")
        .select("comment_id")
        .in("comment_id", commentIds)
        .is("deleted_at", null);

      const likeCountByCommentId: Record<string, number> = {};
      (likeRows ?? []).forEach((row) => {
        likeCountByCommentId[row.comment_id] =
          (likeCountByCommentId[row.comment_id] ?? 0) + 1;
      });

      const sorted = [...rows].sort((a, b) => {
        const likeA = likeCountByCommentId[a.id] ?? 0;
        const likeB = likeCountByCommentId[b.id] ?? 0;
        if (likeA !== likeB) return likeB - likeA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setOrderedCommentIds(sorted.map((row) => row.id));
      setHasMoreComments(true);
      setCommentOrderReady(true);
    };

    fetchCommentOrder();
  }, [reviewId]);

  useEffect(() => {
    loadingCommentsRef.current = loadingComments;
  }, [loadingComments]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMoreComments) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !loadingCommentsRef.current) {
        setCommentPage((prev) => prev + 1);
      }
    });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMoreComments]);

  useEffect(() => {
    const fetchCommentsPage = async () => {
      if (!commentOrderReady || commentPage === 0 || !hasMoreComments) return;
      if (requestedPagesRef.current.has(commentPage)) return;
      requestedPagesRef.current.add(commentPage);
      setLoadingComments(true);

      const from = (commentPage - 1) * COMMENT_PAGE_SIZE;
      const to = from + COMMENT_PAGE_SIZE - 1;
      const pageCommentIds = orderedCommentIds.slice(from, to + 1);
      if (pageCommentIds.length === 0) {
        setHasMoreComments(false);
        setLoadingComments(false);
        return;
      }

      const { data: commentRows, error } = await supabase
        .from("performance_review_comments")
        .select("id,content,created_at,user_id")
        .in("id", pageCommentIds)
        .is("deleted_at", null);

      if (error) {
        setLoadingComments(false);
        return;
      }

      const fetchedRows = (commentRows as CommentItem[]) ?? [];
      const commentMap = new Map(fetchedRows.map((row) => [row.id, row]));
      const nextRows = pageCommentIds
        .map((commentId) => commentMap.get(commentId))
        .filter((row): row is CommentItem => Boolean(row));
      setComments((prev) => {
        const existing = new Set(prev.map((row) => row.id));
        return [...prev, ...nextRows.filter((row) => !existing.has(row.id))];
      });

      if (to >= orderedCommentIds.length - 1) {
        setHasMoreComments(false);
      }

      const userIds = Array.from(new Set(nextRows.map((row) => row.user_id)));
      const commentIds = nextRows.map((row) => row.id);

      if (userIds.length > 0) {
        setCommentProfileResolvedMap((prev) => {
          const next = { ...prev };
          userIds.forEach((id) => {
            if (!(id in next)) next[id] = false;
          });
          return next;
        });
      }

      if (userIds.length > 0 || commentIds.length > 0) {
        const [nextProfiles, likeRows, likedRows, reportRows] = await Promise.all([
          userIds.length > 0
            ? fetchPublicProfiles(userIds)
            : Promise.resolve({} as Record<string, ProfileSummary>),
          commentIds.length > 0
            ? supabase
                .from("performance_review_comment_likes")
                .select("comment_id")
                .in("comment_id", commentIds)
                .is("deleted_at", null)
            : Promise.resolve({ data: [] as { comment_id: string }[] }),
          commentIds.length > 0 && user
            ? supabase
                .from("performance_review_comment_likes")
                .select("comment_id")
                .eq("user_id", user.id)
                .in("comment_id", commentIds)
                .is("deleted_at", null)
            : Promise.resolve({ data: [] as { comment_id: string }[] }),
          commentIds.length > 0
            ? supabase
                .from("performance_review_comment_reports")
                .select("comment_id")
                .in("comment_id", commentIds)
                .is("deleted_at", null)
            : Promise.resolve({ data: [] as { comment_id: string }[] }),
        ]);

        if (userIds.length > 0) {
          setCommentProfileResolvedMap((prev) => {
            const next = { ...prev };
            userIds.forEach((id) => {
              next[id] = true;
            });
            return next;
          });
          setCommentProfiles((prev) => ({ ...prev, ...nextProfiles }));
        }

        if (commentIds.length > 0) {
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

          const nextReportCounts: Record<string, number> = {};
          (reportRows.data ?? []).forEach((row) => {
            nextReportCounts[row.comment_id] =
              (nextReportCounts[row.comment_id] ?? 0) + 1;
          });
          setCommentReportCounts((prev) => ({ ...prev, ...nextReportCounts }));
        }
      }

      setLoadingComments(false);
    };

    fetchCommentsPage();
  }, [
    commentPage,
    reviewId,
    hasMoreComments,
    orderedCommentIds,
    commentOrderReady,
    user,
  ]);

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

  const isReviewHidden = (review?.report_count ?? 0) >= REPORT_THRESHOLD;

  const openReportSheet = (kind: "review" | "comment", id: string) => {
    setReportTarget({ kind, id });
    setReportReason("SPAM");
    setReportDetail("");
    setReportSheetOpen(true);
  };

  const handleSubmitComment = async () => {
    sendHapticToApp();
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
    setOrderedCommentIds((prev) => [data.id, ...prev]);
    setCommentCount((prev) => prev + 1);
    setNewComment("");

    if (!commentProfiles[user.id]) {
      setCommentProfileResolvedMap((prev) => ({ ...prev, [user.id]: false }));
      const profileMap = await fetchPublicProfiles([user.id]);
      setCommentProfileResolvedMap((prev) => ({ ...prev, [user.id]: true }));
      if (profileMap[user.id]) {
        setCommentProfiles((prev) => ({
          ...prev,
          [user.id]: profileMap[user.id],
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
    setUpdatingComment(true);
    const response = await fetch(`/api/review-comments/${commentId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: trimmed }),
    });
    if (!response.ok) {
      setUpdatingComment(false);
      toast("댓글을 수정하지 못했어요.");
      return;
    }
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId ? { ...comment, content: trimmed } : comment
      )
    );
    setUpdatingComment(false);
    setEditingCommentId(null);
    setEditingCommentContent("");
  };

  const handleDeleteComment = async () => {
    sendHapticToApp();
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
    setDeletingComment(true);
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
      setDeletingComment(false);
      toast("댓글을 삭제하지 못했어요.");
      return;
    }
    setComments((prev) => prev.filter((comment) => comment.id !== deleteCommentId));
    setOrderedCommentIds((prev) => prev.filter((id) => id !== deleteCommentId));
    setCommentCount((prev) => Math.max(0, prev - 1));
    setDeletingComment(false);
    setDeleteCommentId(null);
  };

  const handleToggleCommentLike = async (commentId: string) => {
    sendHapticToApp();
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

    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) return;
    const res = await fetch(`/api/review-comments/${commentId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      setCommentLikedMap((prev) => ({ ...prev, [commentId]: false }));
      setCommentLikeCounts((prev) => ({
        ...prev,
        [commentId]: Math.max(0, (prev[commentId] ?? 1) - 1),
      }));
    }
  };

  const handleToggleLike = async () => {
    sendHapticToApp();
    if (!user) {
      openLoginSheet();
      return;
    }

    const isLiked = likedByMe;
    setLikedByMe(!isLiked);
    setLikeCount((prev) => Math.max(0, prev + (isLiked ? -1 : 1)));

    if (isLiked) {
      const { error } = await supabase
        .from("performance_review_likes")
        .delete()
        .eq("review_id", reviewId)
        .eq("user_id", user.id);
      if (error) {
        toast("좋아요를 취소하지 못했어요.");
        setLikedByMe(true);
        setLikeCount((prev) => prev + 1);
      }
      return;
    }

    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) {
      setLikedByMe(false);
      setLikeCount((prev) => Math.max(0, prev - 1));
      return;
    }
    const res = await fetch(`/api/reviews/${reviewId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      toast("좋아요를 남기지 못했어요.");
      setLikedByMe(false);
      setLikeCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleSubmitReport = async () => {
    sendHapticToApp();
    if (!reportTarget) return;
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) return;

    setReporting(true);
    const endpoint =
      reportTarget.kind === "review"
        ? `/api/reviews/${reportTarget.id}/report`
        : `/api/review-comments/${reportTarget.id}/report`;

    const response = await fetch(endpoint, {
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

    if (reportTarget.kind === "review") {
      setReview((prev) =>
        prev
          ? {
              ...prev,
              report_count: reportCount,
            }
          : prev
      );
    } else {
      setCommentReportCounts((prev) => ({
        ...prev,
        [reportTarget.id]: reportCount,
      }));
    }

    setReporting(false);
    setReportSheetOpen(false);
    setReportTarget(null);
    toast("신고가 접수되었어요.");
  };

  const openUserSummarySheet = (userId: string) => {
    sendHapticToApp();
    setSelectedUserId(userId);
    setUserSummarySheetOpen(true);
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

  const handleDeleteReview = async () => {
    sendHapticToApp();
    if (!user) {
      openLoginSheet();
      return;
    }
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) return;
    setDeletingReview(true);
    const response = await fetch(`/api/reviews/${reviewId}/delete`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (!response.ok) {
      setDeletingReview(false);
      toast("리뷰를 삭제하지 못했어요.");
      return;
    }
    invalidatePerformanceHomeCache();
    invalidateDetailCache(performanceId);
    if (user) invalidateProfileCache(user.id);
    router.replace(`/performance/${performanceId}`);
  };

  return (
    <MobileContainer>
      {deletingReview ? <LoadingOverlay /> : null}
      <main className="px-4 pb-12">
        <header className="sticky top-0 z-20 bg-white h-12 mb-6 flex items-center justify-between">
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

        <section className="space-y-4 rounded-2xl border border-[#17171c]/5 bg-white p-5 shadow-sm">
          {performance ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="h-24 w-16 overflow-hidden rounded-lg border border-[#17171c]/5 bg-[#17171c]/5"
                onClick={() => {
                  sendHapticToApp();
                  router.push(`/performance/${performance.mt20id}`);
                }}
                aria-label="공연 상세로 이동"
              >
                {performance.poster ? (
                  <AnimatedImage
                    src={performance.poster}
                    alt={`${performance.prfnm ?? "공연"} 포스터`}
                    width={64}
                    height={96}
                    sizes="64px"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-[#17171c]/50">
                    이미지 없음
                  </div>
                )}
              </button>
              <div className="flex-1">
                <p className="text-sm text-[#17171c]/60">공연</p>
                <p className="text-base font-semibold text-[#17171c]">
                  {performance.prfnm || "공연명 미정"}
                </p>
              </div>
            </div>
          ) : null}

          <Separator className="bg-[#17171c]/5" />

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-[#17171c]/60">
              <div className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  className="truncate text-left underline-offset-2 hover:underline"
                  onClick={() => openUserSummarySheet(review.user_id)}
                  aria-label="사용자 정보 보기"
                >
                  {getDisplayNickname(profile?.nickname, review.user_id, true)}
                </button>
                <span>· {formatDate(review.created_at)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, index) => {
                const ratio = getStarFillRatio(review.rating, index + 1);
                return (
                  <div key={`review-star-${index}`} className="relative h-4 w-4">
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
            {isReviewHidden ? (
              <p className="whitespace-pre-line text-base text-[#17171c]">
                신고로 인해 숨김 처리되었어요.
              </p>
            ) : review.content ? (
              <p className="whitespace-pre-line text-base text-[#17171c]">
                {review.content}
              </p>
            ) : null}
            {!isReviewHidden && images.length > 0 ? (
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
                    <AnimatedImage
                      src={url}
                      alt="리뷰 이미지"
                      width={80}
                      height={80}
                      sizes="80px"
                      draggable={false}
                      className="h-full w-full object-contain"
                    />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex items-center gap-4 text-sm text-[#17171c]">
              <button
                type="button"
                className="inline-flex items-center gap-1"
                onClick={handleToggleLike}
                aria-label="리뷰 좋아요"
              >
                <Heart
                  className="h-4 w-4 text-[#17171c]"
                  fill={likedByMe ? "#17171c" : "none"}
                />
                {likeCount}
              </button>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-4 w-4 text-[#17171c]" />
                {commentCount}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-4 rounded-2xl border border-[#17171c]/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#17171c]">댓글</h2>
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
              className="h-10 min-h-10 flex-1 resize-none rounded-md border border-[#17171c]/5 bg-white px-3 py-2 text-base leading-5 placeholder:text-sm placeholder:leading-5 text-[#17171c] overflow-y-hidden focus:outline-none"
              maxLength={300}
              placeholder="댓글을 입력해 주세요."
            />
            <Button
              type="button"
              className="h-10 w-16 bg-[#17171c] text-sm text-white hover:bg-[#17171c]/90 flex items-center justify-center"
              onClick={handleSubmitComment}
              disabled={submittingComment}
            >
              {submittingComment ? <Spinner size="sm" className="text-white" /> : "등록"}
            </Button>
          </div>
          <div className="space-y-3">
            {comments.length === 0 && !loadingComments ? (
              <p className="text-xs text-[#17171c]/60">첫 댓글을 남겨 보세요.</p>
            ) : (
              comments.map((comment) => {
                const author = commentProfiles[comment.user_id];
                const isMyComment = user?.id === comment.user_id;
                const isCommentHidden =
                  (commentReportCounts[comment.id] ?? 0) >= REPORT_THRESHOLD;
                return (
                  <div
                    key={comment.id}
                    className="rounded-xl border border-[#17171c]/5 bg-[#17171c]/[0.02] p-3 text-base text-[#17171c] transition-colors active:bg-[#17171c]/5"
                  >
                    <div className="flex items-center justify-between text-sm text-[#17171c]/60">
                      <div className="flex min-w-0 items-center gap-1">
                        <button
                          type="button"
                          className="truncate text-left underline-offset-2 hover:underline"
                          onClick={() => openUserSummarySheet(comment.user_id)}
                          aria-label="사용자 정보 보기"
                        >
                          {getDisplayNickname(
                            author?.nickname,
                            comment.user_id,
                            !!commentProfileResolvedMap[comment.user_id],
                          )}
                        </button>
                        <span>· {formatDate(comment.created_at)}</span>
                      </div>
                      {user ? (
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
                          <PopoverContent align="end" className="w-36 p-1">
                            {isMyComment ? (
                              <>
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
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                className="w-full justify-start text-sm"
                                onClick={() => openReportSheet("comment", comment.id)}
                              >
                                <Flag className="mr-2 h-4 w-4" />
                                신고하기
                              </Button>
                            )}
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
                          className="min-h-[120px] w-full rounded-md border border-[#17171c]/5 bg-white p-3 text-base text-[#17171c] focus:outline-none"
                          maxLength={300}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 flex-1"
                            disabled={updatingComment}
                            onClick={() => handleUpdateComment(comment.id)}
                          >
                            {updatingComment ? <Spinner size="sm" /> : "저장"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 flex-1"
                            disabled={updatingComment}
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
                        <p className="mt-2 whitespace-pre-line text-sm text-[#17171c]">
                          {isCommentHidden
                            ? "신고로 인해 숨김 처리되었어요."
                            : comment.content}
                        </p>
                        {!isCommentHidden ? (
                          <button
                            type="button"
                            className="mt-2 inline-flex items-center gap-1 text-sm text-[#17171c]"
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
                        ) : null}
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
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-start"
            onClick={() => {
              setActionSheetOpen(false);
              openReportSheet("review", review.id);
            }}
          >
            <Flag className="mr-2 h-4 w-4" />
            신고하기
          </Button>
        )}
      </BottomSheet>

      <UserProfileSummarySheet
        open={userSummarySheetOpen}
        onOpenChange={setUserSummarySheetOpen}
        userId={selectedUserId}
      />

      <BottomSheet
        open={reportSheetOpen}
        onOpenChange={(open) => {
          setReportSheetOpen(open);
          if (!open) {
            setReportTarget(null);
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
                      ? "border-[#17171c]/40 bg-[#17171c]/5 text-[#17171c]"
                      : "border-[#17171c]/10 text-[#17171c]/80"
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
              className="min-h-[120px] w-full rounded-md border border-[#17171c]/10 bg-white px-3 py-2 text-base text-[#17171c] placeholder:text-sm focus:outline-none"
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
              onClick={handleSubmitReport}
              disabled={reporting}
            >
              {reporting ? <Spinner size="sm" className="text-white" /> : "제출하기"}
            </Button>
          </div>
        </div>
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
              onClick={handleDeleteReview}
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
              disabled={deletingComment}
              onClick={handleDeleteComment}
            >
              {deletingComment ? <Spinner size="sm" /> : "삭제할게요"}
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
