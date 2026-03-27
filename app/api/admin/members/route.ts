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

  type ActivityCountRow = { user_id: string; record_count: number; review_count: number; comment_count: number };
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
