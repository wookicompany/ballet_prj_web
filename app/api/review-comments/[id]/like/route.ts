import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import { sendFCMToUser } from "@/lib/fcm";

/**
 * 댓글 좋아요 등록. insert 후 댓글 작성자에게 FCM 발송(본인 제외).
 * @see docs/rn_webview_integration_plan.md
 */
export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const { id: commentId } = await params;

  const { data: comment, error: commentError } = await auth.supabaseAdmin
    .from("performance_review_comments")
    .select("id, review_id, user_id")
    .eq("id", commentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (commentError) {
    console.error("Failed to load comment", commentError);
    return NextResponse.json(
      { message: "Failed to load comment" },
      { status: 500 }
    );
  }

  if (!comment) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { error: insertError } = await auth.supabaseAdmin
    .from("performance_review_comment_likes")
    .insert({ comment_id: commentId, user_id: auth.user.id });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true });
    }
    console.error("Failed to insert comment like", insertError);
    return NextResponse.json(
      { message: "Failed to add like" },
      { status: 500 }
    );
  }

  if (
    comment.user_id &&
    comment.user_id !== auth.user.id &&
    comment.review_id
  ) {
    const { data: review } = await auth.supabaseAdmin
      .from("performance_reviews")
      .select("performance_id")
      .eq("id", comment.review_id)
      .maybeSingle();

    if (review?.performance_id) {
      void sendFCMToUser(comment.user_id, {
        title: "내 댓글에 좋아요를 눌렀어요",
        link: `https://www.myballet.co.kr/performance/${review.performance_id}/reviews/${comment.review_id}`,
      });
    }
  }

  return NextResponse.json({ ok: true });
};
