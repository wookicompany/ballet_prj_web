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

  // 티켓 소프트 삭제와 "딸린 비공개 리뷰 소프트 삭제"를 한 트랜잭션으로 묶는다.
  //
  // 공개 리뷰는 남긴다 — 커뮤니티에 이미 올라가 다른 사람이 봤을 수 있다. 비공개 리뷰는
  // 커뮤니티에 올라간 적이 없고 티켓을 통해서만 접근하는 개인 기록이라, 티켓만 지우면
  // 사용자가 지운 줄 알았던 리뷰가 프로필 목록에 계속 남는다(실제로 그렇게 남은 건이 있었다).
  //
  // performance_ticket_images는 건드리지 않는다 — records를 소프트 삭제할 때 record_media를
  // 손대지 않는 기존 관례와 같고, 티켓 사진은 항상 티켓 id를 통해서만 조회하므로
  // (단독 조회 화면이 없다) 부모가 가려지면 함께 가려진다.
  const { error: deleteError } = await auth.supabaseAdmin.rpc("soft_delete_ticket", {
    p_ticket_id: id,
    p_user_id: auth.user.id,
  });

  if (deleteError) {
    // RPC가 던지는 코드를 상태로 옮긴다. 위에서 이미 존재와 소유권을 검사했으므로 정상
    // 경로에서는 나지 않지만, 더블탭으로 두 삭제 요청이 겹치는 좁은 창에서는 여기로 들어온다.
    const message = deleteError.message ?? "";
    const status = message.includes("TKT404")
      ? 404
      : message.includes("TKT403")
        ? 403
        : 500;
    if (status === 500) {
      console.error("Failed to delete ticket", deleteError);
    }
    return NextResponse.json({ message: "Failed to delete ticket" }, { status });
  }

  return NextResponse.json({ ok: true });
};
