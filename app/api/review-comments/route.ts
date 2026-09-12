import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import { sendExpoPushToUser } from "@/lib/expoPush";

export const POST = async (request: Request) => {
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const body = await request.json();
  const reviewId = String(body?.review_id ?? "");
  const content =
    typeof body?.content === "string" && body.content.trim()
      ? body.content.trim()
      : "";

  if (!reviewId || !content) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { data: review, error: reviewError } = await auth.supabaseAdmin
    .from("performance_reviews")
    .select("id, user_id, performance_id, is_public")
    .eq("id", reviewId)
    .is("deleted_at", null)
    .maybeSingle();

  if (reviewError) {
    console.error("Failed to load review", reviewError);
    return NextResponse.json(
      { message: "Failed to load review" },
      { status: 500 }
    );
  }

  // 비공개 리뷰는 본인 외에는 존재 자체를 숨긴다(404). 댓글 RLS가 조회는 이미 막지만
  // 이 라우트는 service role INSERT라 별개이고, 댓글 성공 시 작성자에게 푸시가 실제로
  // 발송되기 때문에 막지 않으면 낯선 사람이 비공개 리뷰에 댓글을 달아 알림을 보낼 수 있다.
  if (!review || (!review.is_public && review.user_id !== auth.user.id)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("performance_review_comments")
    .insert({
      review_id: reviewId,
      user_id: auth.user.id,
      content,
    })
    .select("id, content, created_at, user_id")
    .single();

  if (error || !data) {
    console.error("Failed to create comment", error);
    return NextResponse.json(
      { message: "Failed to create comment" },
      { status: 500 }
    );
  }

  if (
    review.user_id &&
    review.user_id !== auth.user.id &&
    review.performance_id
  ) {
    void sendExpoPushToUser(review.user_id, {
      title: "내 리뷰에 댓글이 달렸어요",
      link: `https://www.myballet.co.kr/performance/${review.performance_id}/reviews/${reviewId}`,
    });
  }

  return NextResponse.json(data);
};
