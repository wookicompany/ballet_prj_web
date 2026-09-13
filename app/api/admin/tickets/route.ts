import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type TicketRow = {
  id: string;
  user_id: string;
  performance_id: string | null;
  custom_title: string | null;
  custom_venue: string | null;
  watched_on: string;
  rating: number | null;
  seat: string | null;
  review_id: string | null;
  created_at: string;
  kopis_performances: { prfnm: string | null; fcltynm: string | null; poster: string | null } | null;
  performance_ticket_images: { id: string; deleted_at: string | null }[] | null;
};

export const GET = async (request: Request) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Number(searchParams.get("offset")) || 0;
  const q = searchParams.get("q")?.trim() || "";

  // 리뷰 연결 여부 / 공연 출처 필터
  const reviewParam = searchParams.get("review");
  const review = reviewParam === "with" || reviewParam === "without" ? reviewParam : null;
  const sourceParam = searchParams.get("source");
  const source = sourceParam === "kopis" || sourceParam === "custom" ? sourceParam : null;

  // 닉네임으로도 찾을 수 있게 프로필을 먼저 검색해 user_id를 모은다(기록 관리와 동일).
  let matchingUserIds: string[] = [];
  if (q) {
    const { data: matched } = await result.supabaseAdmin.rpc("search_profiles_by_keyword", {
      keyword: q,
    });
    matchingUserIds = (matched ?? []).map((p) => p.id);
  }

  // 직접 입력 공연명 또는 작성자 닉네임으로 검색한다.
  // KOPIS 공연명은 조인 대상이라 여기서 걸 수 없어 아래에서 id 목록으로 따로 좁힌다.
  let matchingPerformanceIds: string[] = [];
  if (q) {
    const { data: perfs } = await result.supabaseAdmin
      .from("kopis_performances")
      .select("mt20id")
      .ilike("prfnm", `%${q}%`)
      .limit(200);
    matchingPerformanceIds = (perfs ?? []).map((p) => p.mt20id);
  }

  const buildOrStr = () => {
    const parts = [`custom_title.ilike.%${q}%`, `custom_venue.ilike.%${q}%`];
    for (const uid of matchingUserIds) parts.push(`user_id.eq.${uid}`);
    for (const pid of matchingPerformanceIds) parts.push(`performance_id.eq.${pid}`);
    return parts.join(",");
  };

  // 삭제된 티켓은 운영 목적이라도 보여주지 않는다.
  let query = result.supabaseAdmin
    .from("performance_tickets")
    .select(
      "id, user_id, performance_id, custom_title, custom_venue, watched_on, rating, seat, review_id, created_at, kopis_performances(prfnm, fcltynm, poster), performance_ticket_images(id, deleted_at)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (q) query = query.or(buildOrStr());
  if (review === "with") query = query.not("review_id", "is", null);
  if (review === "without") query = query.is("review_id", null);
  if (source === "custom") query = query.is("performance_id", null);
  if (source === "kopis") query = query.not("performance_id", "is", null);

  let countQuery = result.supabaseAdmin
    .from("performance_tickets")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (q) countQuery = countQuery.or(buildOrStr());
  if (review === "with") countQuery = countQuery.not("review_id", "is", null);
  if (review === "without") countQuery = countQuery.is("review_id", null);
  if (source === "custom") countQuery = countQuery.is("performance_id", null);
  if (source === "kopis") countQuery = countQuery.not("performance_id", "is", null);

  const [listResult, countResult] = await Promise.all([
    query.range(offset, offset + limit - 1),
    countQuery,
  ]);

  if (listResult.error) {
    console.error("admin tickets list", listResult.error);
    return NextResponse.json({ message: "Failed to list tickets" }, { status: 500 });
  }

  const rows = (listResult.data ?? []) as unknown as TicketRow[];

  // 작성자 프로필은 id를 모아 한 번에 가져온다(행마다 조회하면 N+1이 된다).
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const profilesMap: Record<string, { nickname: string | null; avatar_url: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await result.supabaseAdmin
      .from("profiles")
      .select("id, nickname, avatar_url")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profilesMap[p.id] = { nickname: p.nickname ?? null, avatar_url: p.avatar_url ?? null };
    }
  }

  const tickets = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    nickname: profilesMap[r.user_id]?.nickname ?? null,
    avatarUrl: profilesMap[r.user_id]?.avatar_url ?? null,
    // poster는 NULL이 아니라 빈 문자열인 공연이 있어 truthy 체크가 필요하다.
    title: r.kopis_performances?.prfnm || r.custom_title || "제목 없음",
    venue: r.kopis_performances?.fcltynm || r.custom_venue || null,
    poster: r.kopis_performances?.poster ? r.kopis_performances.poster : null,
    isCustom: !r.performance_id,
    performanceId: r.performance_id,
    watchedOn: r.watched_on,
    rating: r.rating,
    seat: r.seat,
    reviewId: r.review_id,
    imageCount: (r.performance_ticket_images ?? []).filter((i) => !i.deleted_at).length,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ tickets, total: countResult.count ?? 0 });
};
