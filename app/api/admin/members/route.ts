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
  const [recordCountsRes, reviewCountsRes] = await Promise.all([
    userIds.length > 0
      ? result.supabaseAdmin.from("records").select("user_id").is("deleted_at", null).in("user_id", userIds)
      : { data: [] as { user_id: string }[] },
    userIds.length > 0
      ? result.supabaseAdmin.from("performance_reviews").select("user_id").is("deleted_at", null).in("user_id", userIds)
      : { data: [] as { user_id: string }[] },
  ]);

  const recordCount: Record<string, number> = {};
  for (const r of recordCountsRes.data ?? []) {
    recordCount[r.user_id] = (recordCount[r.user_id] ?? 0) + 1;
  }
  const reviewCount: Record<string, number> = {};
  for (const r of reviewCountsRes.data ?? []) {
    reviewCount[r.user_id] = (reviewCount[r.user_id] ?? 0) + 1;
  }

  const members = (rows ?? []).map((r) => ({
    ...r,
    record_count: recordCount[r.id] ?? 0,
    review_count: reviewCount[r.id] ?? 0,
  }));

  return NextResponse.json({
    members,
    total: count ?? 0,
    limit,
    offset,
  });
};
