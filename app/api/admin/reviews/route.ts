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
    const { data: matched } = await result.supabaseAdmin
      .rpc("search_profiles_by_keyword", { keyword: q });
    matchingUserIds = (matched ?? []).map((p) => p.id);
  }

  const buildOrStr = () => {
    const parts = [`content.ilike.%${q}%`];
    for (const uid of matchingUserIds) parts.push(`user_id.eq.${uid}`);
    return parts.join(",");
  };

  let query = result.supabaseAdmin
    .from("performance_reviews")
    .select("id, performance_id, user_id, rating, content, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (q) query = query.or(buildOrStr());

  let countQuery = result.supabaseAdmin
    .from("performance_reviews")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (q) countQuery = countQuery.or(buildOrStr());

  const [{ data: rows, error }, { count }] = await Promise.all([
    query.range(offset, offset + limit - 1),
    countQuery,
  ]);

  if (error) {
    console.error("admin reviews list", error);
    return NextResponse.json({ message: "Failed to list reviews" }, { status: 500 });
  }

  const performanceIds = [...new Set((rows ?? []).map((r) => r.performance_id))];
  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
  const reviewIds = (rows ?? []).map((r) => r.id);

  const [performancesRes, profilesRes, reportsCountRes] = await Promise.all([
    performanceIds.length > 0
      ? result.supabaseAdmin.from("kopis_performances").select("mt20id, prfnm").in("mt20id", performanceIds)
      : { data: [] as { mt20id: string; prfnm: string | null }[] },
    userIds.length > 0
      ? result.supabaseAdmin.from("profiles").select("id, nickname").in("id", userIds)
      : { data: [] as { id: string; nickname: string | null }[] },
    reviewIds.length > 0
      ? result.supabaseAdmin.from("performance_review_reports").select("review_id").in("review_id", reviewIds)
      : { data: [] as { review_id: string }[] },
  ]);

  const prfnmMap: Record<string, string> = {};
  for (const p of performancesRes.data ?? []) {
    prfnmMap[p.mt20id] = p.prfnm ?? p.mt20id;
  }
  const nicknameMap: Record<string, string | null> = {};
  for (const p of profilesRes.data ?? []) {
    nicknameMap[p.id] = p.nickname;
  }
  const reportCountMap: Record<string, number> = {};
  for (const r of reportsCountRes.data ?? []) {
    reportCountMap[r.review_id] = (reportCountMap[r.review_id] ?? 0) + 1;
  }

  const reviews = (rows ?? []).map((r) => ({
    ...r,
    prfnm: prfnmMap[r.performance_id] ?? r.performance_id,
    nickname: nicknameMap[r.user_id] ?? null,
    report_count: reportCountMap[r.id] ?? 0,
  }));

  return NextResponse.json({
    reviews,
    total: count ?? 0,
    limit,
    offset,
  });
};
