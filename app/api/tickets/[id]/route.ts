import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/apiAuth";
import { isValidDateKey } from "@/lib/kstDateTime";

const toNullableText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const auth = await getUserFromRequest(request);
  if (auth.errorResponse || !auth.user || !auth.supabaseAdmin) {
    return auth.errorResponse;
  }

  // deleted_at 필터는 앱 코드가 반드시 직접 걸어야 한다.
  // performance_tickets_select RLS는 user_id만 검사하고 deleted_at은 보지 않으며,
  // 여기는 service role이라 애초에 RLS가 적용되지 않는다. 빠뜨리면 삭제한 티켓의
  // 상세가 뒤로가기·북마크·캐시된 링크 재진입만으로 그대로 열린다.
  const { data: ticket, error } = await auth.supabaseAdmin
    .from("performance_tickets")
    .select(
      "id, user_id, performance_id, custom_title, custom_venue, watched_on, rating, seat, memo, review_id, deleted_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load ticket", error);
    return NextResponse.json({ message: "Failed to load ticket" }, { status: 500 });
  }
  if (!ticket || ticket.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (ticket.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const [performanceResult, imagesResult] = await Promise.all([
    ticket.performance_id
      ? auth.supabaseAdmin
          .from("kopis_performances")
          .select("mt20id, prfnm, fcltynm, poster")
          .eq("mt20id", ticket.performance_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    auth.supabaseAdmin
      .from("performance_ticket_images")
      .select("id, url")
      .eq("ticket_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  if (imagesResult.error) {
    console.error("Failed to load ticket images", imagesResult.error);
    return NextResponse.json({ message: "Failed to load ticket" }, { status: 500 });
  }

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      performanceId: ticket.performance_id,
      customTitle: ticket.custom_title,
      customVenue: ticket.custom_venue,
      watchedOn: ticket.watched_on,
      rating: ticket.rating,
      seat: ticket.seat,
      memo: ticket.memo,
      reviewId: ticket.review_id,
    },
    performance: performanceResult.data ?? null,
    images: imagesResult.data ?? [],
  });
};

export const PATCH = async (
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
  if (!ticket || ticket.deleted_at) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (ticket.user_id !== auth.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  // 바디는 전체 교체 계약이다 — 네 필드를 매 요청 전부 보낸다. "필드 누락"과 "명시적 null"을
  // 구분하지 않아도 되게 해서, PATCH /api/reviews/[id]가 겪는 부분 업데이트 함정을 피한다.
  const body = await request.json();
  const watchedOn = typeof body?.watched_on === "string" ? body.watched_on : "";
  if (!isValidDateKey(watchedOn)) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  // 티켓의 rating은 nullable이라 리뷰 PATCH의 "항상 2~10 필수" 검증을 복사하면 안 된다.
  // null이면 통과(별점 해제), 값이 있으면 0~10 짝수.
  let rating: number | null = null;
  if (body?.rating !== null && body?.rating !== undefined) {
    const parsed = Number(body.rating);
    if (
      !Number.isFinite(parsed) ||
      !Number.isInteger(parsed) ||
      parsed < 0 ||
      parsed > 10 ||
      parsed % 2 !== 0
    ) {
      return NextResponse.json({ message: "Bad request" }, { status: 400 });
    }
    rating = parsed === 0 ? null : parsed;
  }

  const { error: updateError } = await auth.supabaseAdmin
    .from("performance_tickets")
    .update({
      watched_on: watchedOn,
      rating,
      seat: toNullableText(body?.seat),
      memo: toNullableText(body?.memo),
      // updated_at은 performance_tickets_set_updated_at 트리거가 갱신한다.
    })
    .eq("id", id);

  if (updateError) {
    console.error("Failed to update ticket", updateError);
    return NextResponse.json({ message: "Failed to update ticket" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};
