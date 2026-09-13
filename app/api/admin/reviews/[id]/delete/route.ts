import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export const DELETE = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { id } = await params;

  const { data: row, error: fetchError } = await result.supabaseAdmin
    .from("performance_reviews")
    .select("id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to load review", fetchError);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
  if (!row || row.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  // 유저 삭제 경로와 동일하게 티켓의 review_id도 함께 복원한다 — 어드민이 지운 경우에도
  // 티켓이 죽은 리뷰를 가리킨 채 남으면 안 된다. p_user_id를 넘기지 않으면 소유권 검사를
  // 건너뛴다(어드민 경로).
  const { error: updateError } = await result.supabaseAdmin.rpc("soft_delete_review", {
    p_review_id: id,
  });

  if (updateError) {
    console.error("admin review delete", updateError);
    return NextResponse.json({ message: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};
