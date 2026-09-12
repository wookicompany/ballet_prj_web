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

  const [performanceResult, imagesResult, reviewResult] = await Promise.all([
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
    // 연결된 리뷰를 실제로 읽어온다. review_id가 있다는 사실만 믿으면 안 된다 — 리뷰가
    // 다른 경로(공연 상세, 어드민)에서 삭제됐을 수 있고, 그러면 티켓이 죽은 리뷰를
    // 가리킨 채 남는다.
    ticket.review_id
      ? auth.supabaseAdmin
          .from("performance_reviews")
          .select("id, rating, content, is_public, created_at")
          .eq("id", ticket.review_id)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (imagesResult.error) {
    console.error("Failed to load ticket images", imagesResult.error);
    return NextResponse.json({ message: "Failed to load ticket" }, { status: 500 });
  }

  const review = reviewResult.data ?? null;

  // 자가 복구: review_id는 있는데 리뷰가 사라졌다면 연결을 끊는다. 이 줄이 없으면
  // 그 티켓은 멱등 가드에 걸려 영원히 새 리뷰를 쓸 수 없다. 삭제 라우트가 복원을
  // 담당하지만, 그 경로를 타지 않고 지워진 과거 데이터까지 여기서 정리된다.
  if (ticket.review_id && !review) {
    const { error: healError } = await auth.supabaseAdmin
      .from("performance_tickets")
      .update({ review_id: null })
      .eq("id", id);
    if (healError) {
      // 복구에 실패해도 조회 자체는 성공시킨다 — 아래에서 review를 null로 내려보내므로
      // 화면은 "리뷰 없음"으로 올바르게 그려진다. 다음 조회에서 다시 시도된다.
      console.error("Failed to clear stale review_id", healError);
    }
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
      // 살아 있는 리뷰가 있을 때만 id를 내려보낸다.
      reviewId: review?.id ?? null,
    },
    performance: performanceResult.data ?? null,
    images: imagesResult.data ?? [],
    review: review
      ? {
          id: review.id,
          rating: review.rating,
          content: review.content,
          isPublic: review.is_public,
          createdAt: review.created_at,
        }
      : null,
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
    .select("id, user_id, deleted_at, review_id")
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

  // 연결된 리뷰가 있으면 별점을 함께 맞춘다(PM 확정). 등록 화면에서 하나의 별점을 티켓과
  // 리뷰 양쪽에 쓰는 구조라, 수정할 때만 티켓 쪽만 바뀌면 같은 공연에 별점이 두 개가 된다.
  //
  // 티켓의 별점을 해제(null)한 경우에는 리뷰를 건드리지 않는다 —
  // performance_reviews.rating은 NOT NULL이라 null로 만들 수 없고, 이미 커뮤니티에 올라간
  // 리뷰의 별점을 임의의 값으로 바꾸는 것도 맞지 않다.
  if (ticket.review_id && rating !== null) {
    const { error: reviewError } = await auth.supabaseAdmin
      .from("performance_reviews")
      .update({ rating })
      .eq("id", ticket.review_id)
      .is("deleted_at", null);
    if (reviewError) {
      // 티켓 수정은 이미 반영됐다. 여기서 실패해도 저장 자체를 되돌리지는 않되,
      // 조용히 넘기지 않도록 로그를 남기고 부분 실패를 알린다.
      console.error("Failed to sync review rating", reviewError);
      return NextResponse.json(
        { message: "Ticket updated but review rating sync failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
};
