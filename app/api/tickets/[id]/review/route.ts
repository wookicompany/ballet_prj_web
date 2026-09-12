import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";

// RPC가 던지는 커스텀 에러를 HTTP 상태로 매핑한다. 매칭되지 않는 에러는 반드시 500으로
// 떨어뜨리고 로그를 남긴다 — 알 수 없는 실패를 200으로 흘려보내면 all-or-nothing이 깨진다.
const mapRpcError = (message: string): number => {
  if (message.includes("TKT404")) return 404;
  if (message.includes("TKT409")) return 409;
  if (message.includes("TKT400")) return 400;
  return 500;
};

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  const body = await request.json();
  const rating = Number(body?.rating ?? 0);
  const content = typeof body?.content === "string" ? body.content : "";
  const isPublic = body?.is_public === true;

  // RPC도 같은 검증을 하지만, 여기서 먼저 걸러 불필요한 DB 왕복을 줄인다.
  if (
    !Number.isFinite(rating) ||
    !Number.isInteger(rating) ||
    rating < 2 ||
    rating > 10 ||
    rating % 2 !== 0 ||
    !content.trim()
  ) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  // 소유권 확인, 멱등 가드(이미 리뷰가 있으면 409), 직접 입력 공연 차단, 리뷰 insert,
  // 티켓 연결을 한 트랜잭션에서 처리한다 — 앱에서 2단계로 나누면 리뷰만 만들어지고
  // 티켓에 연결되지 않은 고아 리뷰가 남을 수 있다.
  //
  // 이 프로젝트의 RPC는 서비스 롤로 호출돼 함수 안에서 auth.uid()가 NULL이므로
  // p_user_id를 인자로 넘긴다(create_record_recurrences와 동일 관례).
  const { data, error } = await auth.supabaseAdmin
    .rpc("create_ticket_review", {
      p_ticket_id: id,
      p_user_id: auth.user.id,
      p_rating: rating,
      p_content: content,
      p_is_public: isPublic,
    })
    .single();

  if (error) {
    const status = mapRpcError(error.message ?? "");
    if (status === 500) {
      console.error("Failed to create ticket review", error);
    }
    return NextResponse.json({ message: error.message ?? "Failed" }, { status });
  }

  return NextResponse.json({
    reviewId: data?.review_id ?? null,
    performanceId: data?.performance_id ?? null,
  });
};
