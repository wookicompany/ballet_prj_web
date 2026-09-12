import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import { sendExpoPushToUser } from "@/lib/expoPush";

/**
 * 리뷰 좋아요 등록. insert 후 리뷰 작성자에게 Expo Push 발송(본인 제외).
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

  // 비공개 리뷰는 본인 외에는 존재 자체를 숨긴다(404). service role이라 RLS를 우회하므로
  // 이 검사가 유일한 방어선이고, 좋아요 성공 시 작성자에게 푸시가 실제로 발송되기 때문에
  // 빠뜨리면 낯선 사람이 비공개 리뷰에 좋아요를 눌러 알림까지 보낼 수 있다.
  if (!review || (!review.is_public && review.user_id !== auth.user.id)) {
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
    void sendExpoPushToUser(review.user_id, {
      title: "내 리뷰에 좋아요를 눌렀어요",
      link: `https://www.myballet.co.kr/performance/${review.performance_id}/reviews/${reviewId}`,
    });
  }

  return NextResponse.json({ ok: true });
};
