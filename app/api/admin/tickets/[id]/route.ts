import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { id } = await params;

  const { data: ticket, error: ticketError } = await result.supabaseAdmin
    .from("performance_tickets")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (ticketError) {
    console.error("admin ticket get", ticketError);
    return NextResponse.json({ message: "Failed to load ticket" }, { status: 500 });
  }
  if (!ticket) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const [{ data: profile }, { data: images }, { data: performance }, { data: review }] =
    await Promise.all([
      result.supabaseAdmin
        .from("profiles")
        .select("nickname, avatar_url")
        .eq("id", ticket.user_id)
        .maybeSingle(),
      result.supabaseAdmin
        .from("performance_ticket_images")
        .select("id, url, created_at")
        .eq("ticket_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      ticket.performance_id
        ? result.supabaseAdmin
            .from("kopis_performances")
            .select("mt20id, prfnm, fcltynm, poster")
            .eq("mt20id", ticket.performance_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // 연결된 리뷰는 어드민이라 공개 여부와 무관하게 전부 본다(admin/reviews와 동일).
      // 다만 화면에서 비공개 배지를 달 수 있도록 is_public을 함께 내려보낸다.
      ticket.review_id
        ? result.supabaseAdmin
            .from("performance_reviews")
            .select("id, rating, content, is_public, created_at")
            .eq("id", ticket.review_id)
            .is("deleted_at", null)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      userId: ticket.user_id,
      nickname: profile?.nickname ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      performanceId: ticket.performance_id,
      isCustom: !ticket.performance_id,
      // poster는 NULL이 아니라 빈 문자열인 공연이 있어 truthy 체크가 필요하다.
      title: performance?.prfnm || ticket.custom_title || "제목 없음",
      venue: performance?.fcltynm || ticket.custom_venue || null,
      poster: performance?.poster ? performance.poster : null,
      watchedOn: ticket.watched_on,
      rating: ticket.rating,
      seat: ticket.seat,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    },
    images: images ?? [],
    // review_id가 있어도 리뷰가 삭제됐으면 null이 온다 — 화면은 "리뷰 없음"으로 그린다.
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
