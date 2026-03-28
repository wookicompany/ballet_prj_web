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
    .select("id, user_id, performance_id")
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

  if (!review) {
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
