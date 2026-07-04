import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = async (request: Request) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Number(searchParams.get("offset")) || 0;
  const q = searchParams.get("q")?.trim() || "";
  const sort = searchParams.get("sort") || "created_at_desc";
  // sort: "created_at_desc" | "record_count_desc" | "record_count_asc"
  //       | "review_count_desc" | "review_count_asc"
  //       | "comment_count_desc" | "comment_count_asc"
  //       | "like_brand_count_desc" | "like_brand_count_asc"

  type ActivityCountRow = { user_id: string; record_count: number; review_count: number; comment_count: number };
  type AuthUserRow = { id: string; email: string | null; created_at: string; total_count: number };
  type ProfileMap = Record<string, { nickname: string | null; avatar_url: string | null }>;

  const isSortByActivity = [
    "record_count_desc", "record_count_asc",
    "review_count_desc", "review_count_asc",
    "comment_count_desc", "comment_count_asc",
  ].includes(sort);
  const isSortByLikeBrand = sort === "like_brand_count_desc" || sort === "like_brand_count_asc";

  const fetchLikeBrandCounts = async (ids: string[]): Promise<Record<string, number>> => {
    if (!ids.length) return {};
    const { data } = await result.supabaseAdmin
      .from("brand_likes")
      .select("user_id")
      .in("user_id", ids)
      .is("deleted_at", null);
    const map: Record<string, number> = {};
    for (const row of data ?? []) {
      if (row.user_id) map[row.user_id] = (map[row.user_id] ?? 0) + 1;
    }
    return map;
  };

  const fetchActivityCounts = async (ids: string[]): Promise<Record<string, ActivityCountRow>> => {
    if (!ids.length) return {};
    const { data } = await result.supabaseAdmin
      .rpc("get_activity_counts_by_user_ids", { user_ids: ids });
    const map: Record<string, ActivityCountRow> = {};
    for (const row of (data ?? []) as ActivityCountRow[]) {
      map[row.user_id] = row;
    }
    return map;
  };

  // profiles가 없는 계정(탈퇴·프로필 미생성)도 목록에 포함되므로 있으면 채우고 없으면 null
  const fetchProfileMap = async (ids: string[]) => {
    if (!ids.length) return { map: {} as ProfileMap, error: null };
    const { data, error } = await result.supabaseAdmin
      .from("profiles")
      .select("id, nickname, avatar_url")
      .in("id", ids);
    const map: ProfileMap = {};
    for (const row of data ?? []) {
      map[row.id] = { nickname: row.nickname, avatar_url: row.avatar_url };
    }
    return { map, error };
  };

  const buildMember = (
    u: AuthUserRow,
    profileMap: ProfileMap,
    activityMap: Record<string, ActivityCountRow>,
    likeBrandMap: Record<string, number>
  ) => ({
    id: u.id,
    nickname: profileMap[u.id]?.nickname ?? null,
    avatar_url: profileMap[u.id]?.avatar_url ?? null,
    created_at: u.created_at,
    email: u.email,
    record_count: activityMap[u.id]?.record_count ?? 0,
    review_count: activityMap[u.id]?.review_count ?? 0,
    comment_count: activityMap[u.id]?.comment_count ?? 0,
    like_brand_count: likeBrandMap[u.id] ?? 0,
  });

  if (isSortByActivity || isSortByLikeBrand) {
    // 1. 검색 조건에 맞는 auth 유저 전체 조회 (카운트 정렬은 전체를 알아야 가능)
    const { data: allRows, error: allError } = await result.supabaseAdmin
      .rpc("search_auth_users", { keyword: q || null });
    if (allError) {
      console.error("admin members list", allError);
      return NextResponse.json({ message: "Failed to list members" }, { status: 500 });
    }
    const allUsers = (allRows ?? []) as AuthUserRow[];
    const total = allUsers.length;
    const allIds = allUsers.map((u) => u.id);

    // 2. 정렬 기준 카운트 전체 조회
    const [activityMap, likeBrandMap] = await Promise.all([
      fetchActivityCounts(allIds),
      fetchLikeBrandCounts(allIds),
    ]);

    // 3. 카운트 기준 정렬 후 페이지네이션 — RPC가 가입일 최신순으로 반환하므로
    //    JS 안정 정렬 특성상 카운트 동률은 가입일 최신순 유지
    const ascending = sort.endsWith("_asc");
    const countField = sort.replace(/_desc$|_asc$/, "") as "record_count" | "review_count" | "comment_count";
    const sorted = [...allUsers].sort((a, b) => {
      const av = isSortByLikeBrand ? (likeBrandMap[a.id] ?? 0) : (activityMap[a.id]?.[countField] ?? 0);
      const bv = isSortByLikeBrand ? (likeBrandMap[b.id] ?? 0) : (activityMap[b.id]?.[countField] ?? 0);
      return ascending ? av - bv : bv - av;
    });
    const pageUsers = sorted.slice(offset, offset + limit);

    if (pageUsers.length === 0) {
      return NextResponse.json({ members: [], total, limit, offset });
    }

    // 4. 페이지 유저 프로필 조회
    const { map: profileMap, error: profileError } = await fetchProfileMap(pageUsers.map((u) => u.id));
    if (profileError) {
      console.error("admin members list", profileError);
      return NextResponse.json({ message: "Failed to list members" }, { status: 500 });
    }

    const members = pageUsers.map((u) => buildMember(u, profileMap, activityMap, likeBrandMap));
    return NextResponse.json({ members, total, limit, offset });
  }

  // 기본 정렬: 가입일 최신순 — SQL(search_auth_users)에서 정렬·검색·페이지네이션 처리
  const { data: pageRows, error: pageError } = await result.supabaseAdmin
    .rpc("search_auth_users", { keyword: q || null, p_limit: limit, p_offset: offset });
  if (pageError) {
    console.error("admin members list", pageError);
    return NextResponse.json({ message: "Failed to list members" }, { status: 500 });
  }
  const pageUsers = (pageRows ?? []) as AuthUserRow[];
  const total = Number(pageUsers[0]?.total_count ?? 0);
  const userIds = pageUsers.map((u) => u.id);

  const [{ map: profileMap, error: profileError }, activityMap, likeBrandMap] = await Promise.all([
    fetchProfileMap(userIds),
    fetchActivityCounts(userIds),
    fetchLikeBrandCounts(userIds),
  ]);
  if (profileError) {
    console.error("admin members list", profileError);
    return NextResponse.json({ message: "Failed to list members" }, { status: 500 });
  }

  const members = pageUsers.map((u) => buildMember(u, profileMap, activityMap, likeBrandMap));
  return NextResponse.json({ members, total, limit, offset });
};
