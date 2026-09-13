import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const { data: review, error: reviewError } = await auth.supabaseAdmin
    .from("performance_reviews")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (reviewError) {
    console.error("Failed to load review", reviewError);
    return NextResponse.json(
      { message: "Failed to load review" },
      { status: 500 }
    );
  }

  if (!review || review.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (review.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const rating = Number(body?.rating ?? 0);
  const content =
    typeof body?.content === "string" && body.content.trim()
      ? body.content.trim()
      : null;

  if (
    !Number.isFinite(rating) ||
    !Number.isInteger(rating) ||
    rating < 2 ||
    rating > 10 ||
    rating % 2 !== 0
  ) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const { error: updateError } = await auth.supabaseAdmin
    .from("performance_reviews")
    .update({ rating, content })
    .eq("id", id)
    .is("deleted_at", null);

  // 이 리뷰를 가리키는 티켓이 있으면 별점을 함께 맞춘다. 티켓북에서 하나의 별점을
  // 티켓과 리뷰 양쪽에 쓰기 때문에, 여기서 리뷰만 바꾸면 같은 공연에 별점이 두 개가
  // 되어 티켓 상세와 리뷰 카드가 서로 다른 점수를 보여준다.
  // (티켓 PATCH의 역방향이다 — app/api/tickets/[id]/route.ts 참고)
  if (!updateError) {
    const { error: ticketSyncError } = await auth.supabaseAdmin
      .from("performance_tickets")
      .update({ rating })
      .eq("review_id", id)
      .is("deleted_at", null);
    if (ticketSyncError) {
      // 리뷰 수정은 이미 반영됐다. 되돌리지는 않되 조용히 넘기지 않는다.
      console.error("Failed to sync ticket rating", ticketSyncError);
    }
  }

  if (updateError) {
    console.error("Failed to update review", updateError);
    return NextResponse.json(
      { message: "Failed to update review" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};
