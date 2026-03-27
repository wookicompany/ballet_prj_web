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

  let matchingUserIds: string[] = [];
  if (q) {
    const { data: matchingProfiles } = await result.supabaseAdmin
      .from("profiles")
      .select("id")
      .or(`nickname.ilike.%${q}%,id.ilike.%${q}%`)
      .is("deleted_at", null)
      .limit(500);
    matchingUserIds = (matchingProfiles ?? []).map((p) => p.id);
  }

  const buildOrStr = () => {
    const parts = [`content.ilike.%${q}%`];
    if (matchingUserIds.length > 0) parts.push(`user_id.in.(${matchingUserIds.join(",")})`);
    return parts.join(",");
  };

  let query = result.supabaseAdmin
    .from("records")
    .select("id, user_id, record_date, start_time, end_time, content, mood, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (q) query = query.or(buildOrStr());

  let countQuery = result.supabaseAdmin
    .from("records")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (q) countQuery = countQuery.or(buildOrStr());

  const [{ data: rows, error }, { count }] = await Promise.all([
    query.range(offset, offset + limit - 1),
    countQuery,
  ]);

  if (error) {
    console.error("admin records list", error);
    return NextResponse.json({ message: "Failed to list records" }, { status: 500 });
  }

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
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

  const recordsWithProfile = (rows ?? []).map((r) => ({
    ...r,
    nickname: profilesMap[r.user_id]?.nickname ?? null,
    avatar_url: profilesMap[r.user_id]?.avatar_url ?? null,
  }));

  return NextResponse.json({
    records: recordsWithProfile,
    total: count ?? 0,
    limit,
    offset,
  });
};
