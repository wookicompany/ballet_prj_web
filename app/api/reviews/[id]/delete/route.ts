import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

export const DELETE = async (
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

  // 리뷰 소프트 삭제와 "이 리뷰를 가리키던 티켓의 review_id 복원"을 한 트랜잭션으로 묶는다.
  // review_id FK의 ON DELETE SET NULL은 하드 삭제에만 반응하는데 리뷰 삭제는 전부 소프트
  // 삭제라 발동하지 않는다. 복원을 빠뜨리면 그 티켓이 멱등 가드(TKT409)에 걸려 다시는
  // 리뷰를 쓸 수 없고, 티켓 상세는 이미 삭제된 리뷰를 계속 가리킨다.
  const { error: updateError } = await auth.supabaseAdmin.rpc("soft_delete_review", {
    p_review_id: id,
    p_user_id: auth.user.id,
  });

  if (updateError) {
    // RPC가 던지는 코드를 상태로 옮긴다. 위에서 이미 존재·소유권을 검사했으므로
    // 정상 경로에서는 나지 않지만, 더블탭으로 두 삭제 요청이 겹치는 좁은 창에서는
    // 여기로 들어온다 — 그때 500 대신 404를 주는 편이 정확하다.
    const message = updateError.message ?? "";
    const status = message.includes("RVW404")
      ? 404
      : message.includes("RVW403")
        ? 403
        : 500;
    if (status === 500) {
      console.error("Failed to delete review", updateError);
    }
    return NextResponse.json(
      { message: "Failed to delete review" },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
};
