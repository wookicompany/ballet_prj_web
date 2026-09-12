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

  const { data: ticket, error: loadError } = await auth.supabaseAdmin
    .from("performance_tickets")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    console.error("Failed to load ticket", loadError);
    return NextResponse.json({ message: "Failed to load ticket" }, { status: 500 });
  }
  // 이미 삭제된 티켓에 대한 재요청은 200이 아니라 404다(리뷰 삭제 라우트와 동일).
  if (!ticket || ticket.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (ticket.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // 소프트 삭제 — deleted_at만 갱신한다.
  //
  // 연결된 review_id는 건드리지 않는다: 티켓을 지워도 커뮤니티에 올린 리뷰는 남는 것이
  // 확정된 정책이다. performance_ticket_images도 건드리지 않는다 — records를 소프트
  // 삭제할 때 record_media를 손대지 않는 기존 관례와 같고, 티켓 사진은 항상 티켓 id를
  // 통해서만 조회하므로(단독 조회 화면이 없다) 부모가 가려지면 함께 가려진다.
  const { error: deleteError } = await auth.supabaseAdmin
    .from("performance_tickets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (deleteError) {
    console.error("Failed to delete ticket", deleteError);
    return NextResponse.json({ message: "Failed to delete ticket" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};
