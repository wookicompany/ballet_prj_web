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

  type ActivityCountRow = { user_id: string; record_count: number; review_count: number; comment_count: number };

  const isSortByCount = sort !== "created_at_desc";

  if (isSortByCount) {
    // 1. 검색 조건에 맞는 모든 유저 ID 조회
    let allIdsQuery = result.supabaseAdmin
      .from("profiles")
      .select("id")
      .is("deleted_at", null);
    if (q) allIdsQuery = allIdsQuery.or(`nickname.ilike.%${q}%,id.ilike.%${q}%`);
    const { data: allIdRows, error: idError } = await allIdsQuery;
    if (idError) {
      console.error("admin members list", idError);
      return NextResponse.json({ message: "Failed to list members" }, { status: 500 });
    }
    const allIds = (allIdRows ?? []).map((r) => r.id);
    const total = allIds.length;

    // 2. 전체 유저의 카운트 조회
    const activityCounts: ActivityCountRow[] = allIds.length > 0
      ? ((await result.supabaseAdmin.rpc("get_activity_counts_by_user_ids", { user_ids: allIds })).data ?? []) as ActivityCountRow[]
      : [];

    const activityMap: Record<string, ActivityCountRow> = {};
    for (const row of activityCounts) {
      activityMap[row.user_id] = row;
    }

    // 3. 카운트 기준 정렬 후 페이지네이션
    const countField = sort.replace(/_desc$|_asc$/, "") as "record_count" | "review_count" | "comment_count";
    const ascending = sort.endsWith("_asc");
    const sortedIds = [...allIds].sort((a, b) => {
      const diff = (activityMap[a]?.[countField] ?? 0) - (activityMap[b]?.[countField] ?? 0);
      return ascending ? diff : -diff;
    });
    const pageIds = sortedIds.slice(offset, offset + limit);

    if (pageIds.length === 0) {
      return NextResponse.json({ members: [], total, limit, offset });
    }

    // 4. 페이지 유저 프로필 조회
    const { data: rows, error } = await result.supabaseAdmin
      .from("profiles")
      .select("id, nickname, avatar_url, created_at")
      .in("id", pageIds);

    if (error) {
      console.error("admin members list", error);
      return NextResponse.json({ message: "Failed to list members" }, { status: 500 });
    }

    const rowMap = Object.fromEntries((rows ?? []).map((r) => [r.id, r]));
    const members = pageIds
      .map((id) => rowMap[id])
      .filter(Boolean)
      .map((r) => ({
        ...r,
        record_count: activityMap[r.id]?.record_count ?? 0,
        review_count: activityMap[r.id]?.review_count ?? 0,
        comment_count: activityMap[r.id]?.comment_count ?? 0,
      }));

    return NextResponse.json({ members, total, limit, offset });
  }

  // 기본 정렬: 가입일 최신순
  let profileQuery = result.supabaseAdmin
    .from("profiles")
    .select("id, nickname, avatar_url, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (q) profileQuery = profileQuery.or(`nickname.ilike.%${q}%,id.ilike.%${q}%`);

  let countQuery = result.supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (q) countQuery = countQuery.or(`nickname.ilike.%${q}%,id.ilike.%${q}%`);

  const [{ data: rows, error }, { count }] = await Promise.all([
    profileQuery.range(offset, offset + limit - 1),
    countQuery,
  ]);

  if (error) {
    console.error("admin members list", error);
    return NextResponse.json({ message: "Failed to list members" }, { status: 500 });
  }

  const userIds = (rows ?? []).map((r) => r.id);
  const activityCounts: ActivityCountRow[] = userIds.length > 0
    ? ((await result.supabaseAdmin.rpc("get_activity_counts_by_user_ids", { user_ids: userIds })).data ?? []) as ActivityCountRow[]
    : [];

  const activityMap: Record<string, ActivityCountRow> = {};
  for (const row of activityCounts) {
    activityMap[row.user_id] = row;
  }

  const members = (rows ?? []).map((r) => ({
    ...r,
    record_count: activityMap[r.id]?.record_count ?? 0,
    review_count: activityMap[r.id]?.review_count ?? 0,
    comment_count: activityMap[r.id]?.comment_count ?? 0,
  }));

  return NextResponse.json({
    members,
    total: count ?? 0,
    limit,
    offset,
  });
};
