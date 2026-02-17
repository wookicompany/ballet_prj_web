import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import { sendFCMToUser } from "@/lib/fcm";

/**
 * 리뷰 좋아요 등록. insert 후 리뷰 작성자에게 FCM 발송(본인 제외).
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

  const { id: reviewId } = await params;

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

  const { error: insertError } = await auth.supabaseAdmin
    .from("performance_review_likes")
    .insert({ review_id: reviewId, user_id: auth.user.id });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true });
    }
    console.error("Failed to insert like", insertError);
    return NextResponse.json(
      { message: "Failed to add like" },
      { status: 500 }
    );
  }

  if (
    review.user_id &&
    review.user_id !== auth.user.id &&
    review.performance_id
  ) {
    void sendFCMToUser(review.user_id, {
      title: "내 리뷰에 좋아요를 눌렀어요",
      link: `https://www.myballet.co.kr/performance/${review.performance_id}/reviews/${reviewId}`,
    });
  }

  return NextResponse.json({ ok: true });
};
